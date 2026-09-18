import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { workKey, type WorkloadGroup } from "../workload";
import { ASSIGNMENT_LIMITS } from "./objective";
import type { GateLedgerCell, GateResult } from "./gate";

/**
 * 판정 결과 적재 — **근거를 얼려 둔다**(설계 §5.4).
 *
 * 그룹 값은 `operators` 의 컬럼이라 나중에 바뀐다. 그때 이 배치를 다시 설명할 수
 * 없게 되므로 판정에 쓴 값을 `basis` 에 함께 넣는다. 관리자가 '에이전트가 관리하는
 * 모든 사항' 을 확인해야 하므로(사용자 요구) 모델이 무엇을 보고 그랬는지도 남는다.
 *
 * **PostgREST 에는 호출 사이 트랜잭션이 없다.** 배치를 먼저 넣고 제안을 넣으므로
 * '배치는 만들어졌는데 제안 적재가 실패' 라는 반쪽 상태가 생긴다 — 그걸 '실패' 로만
 * 말하면 관리자가 다시 돌려 빈 배치가 둘 쌓인다. 메시지에서 갈라 말한다(PR4b 의
 * 원장·이력 적재와 같은 사정).
 */

/** 배정은 운영 칸이다 — 개발자는 `operators` 밖이라 배정 대상이 될 수 없다(PR4b). */
const OPERATION_ROLE = "운영";

export type PersistProposalInput = {
  academicYear: number;
  kind: "annual" | "single";
  requestedBy: string;
  /** 판정에 쓴 배분현황. 그룹 구성·목표·실측이 여기서 얼려진다. */
  groups: readonly WorkloadGroup[];
  /** 하위유형 확장에 쓴다 — 이동 하나가 원장 여러 줄이 된다. */
  ledger: readonly GateLedgerCell[];
  gateResult: GateResult;
  model: string;
  /** 프롬프트 원문은 안 남긴다 — 해시로 '무엇으로 물었나' 만 붙인다. */
  promptHash: string;
  verdictRaw: string;
};

export type PersistProposalResult =
  | { ok: false; error: string }
  | {
      ok: true;
      batchId: string;
      proposals: number;
      rejected: number;
      summary: string;
    };

/**
 * 배치 한 줄 요약 — **통과와 탈락을 함께** 적는다(F11).
 *
 * 통과만 적으면 관리자는 '에이전트가 3건만 제안했다' 로 읽고 모델이 멍청하다고
 * 결론 낸다. 어느 게이트에서 몇 건이 떨어졌는지가 곧 조치다.
 */
export function summarizeGateResult(result: GateResult): string {
  const head = `이동 ${result.accepted.length}건`;
  if (result.rejected.length === 0) return head;

  const byGate = new Map<string, number>();
  for (const r of result.rejected) {
    byGate.set(r.gate, (byGate.get(r.gate) ?? 0) + 1);
  }
  const detail = [...byGate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([gate, n]) => `${gate} ${n}`)
    .join(" · ");
  return `${head} · 탈락 ${result.rejected.length}건(${detail})`;
}

/**
 * `basis` — 판정 당시의 스냅샷.
 *
 * `groups` 는 **그룹 구성**(그룹 → 사람)이다. 목표가 아니라 구성인 이유는 3월 갱신
 * 상기가 "지금 구성이 직전 annual 배치와 같은가" 를 견주기 때문이다(§6.4 결정 5) —
 * 목표만 남기면 사람이 바뀌었는데 평균이 같은 경우를 '안 바뀜' 으로 읽는다.
 */
function buildBasis(input: PersistProposalInput) {
  const groups: Record<string, string[]> = {};
  const targets: Record<string, { universities: number; density: number }> = {};
  const measured: {
    email: string;
    universities: number;
    services: number;
    density: number;
    deviation: number | null;
  }[] = [];

  for (const g of input.groups) {
    groups[g.group] = g.rows.map((r) => r.email).sort();
    if (g.target) targets[g.group] = g.target;
    for (const r of g.rows) {
      measured.push({
        email: r.email,
        universities: r.universities,
        services: r.services,
        density: r.density,
        deviation: r.deviation,
      });
    }
  }

  return {
    groups,
    targets,
    measured,
    limits: ASSIGNMENT_LIMITS,
    model: input.model,
    prompt_hash: input.promptHash,
    verdict_raw: input.verdictRaw,
    // 탈락 줄 — 자연키 + 어긴 게이트 + 읽을 수 있는 이유(§6.3).
    rejected: input.gateResult.rejected.map((r) => ({
      university_name: r.move.university_name,
      work_kind: r.move.work_kind,
      prev_assignee: r.move.prev_assignee,
      next_assignee: r.move.next_assignee,
      gate: r.gate,
      reason: r.reason,
    })),
  };
}

export async function persistProposalBatch(
  input: PersistProposalInput,
): Promise<PersistProposalResult> {
  const summary = summarizeGateResult(input.gateResult);

  /**
   * 이동 하나 → 원장 하위유형마다 한 줄. **자연키에 하위유형이 있어서** 그렇고,
   * 하위유형을 가려 옮기면 그게 분할이다(rev 4).
   */
  const subtypesOf = new Map<string, GateLedgerCell[]>();
  for (const c of input.ledger) {
    if (c.role !== OPERATION_ROLE) continue;
    const k = workKey(c);
    subtypesOf.set(k, [...(subtypesOf.get(k) ?? []), c]);
  }

  const proposalRows: Record<string, unknown>[] = [];
  for (const m of input.gateResult.accepted) {
    const cells = subtypesOf.get(workKey(m));
    // 게이트가 통과시킨 이동인데 원장에 칸이 없다 — 배선이 어긋난 것이다.
    // 조용히 건너뛰면 '이동 3건' 이라 적힌 배치에 제안이 두 줄만 든다.
    if (!cells || cells.length === 0) {
      return {
        ok: false,
        error: `원장에 없는 칸을 옮기려 했습니다: ${m.university_name} ${m.work_kind}`,
      };
    }
    for (const c of cells) {
      proposalRows.push({
        academic_year: input.academicYear,
        university_name: m.university_name,
        work_kind: m.work_kind,
        subtype: c.subtype,
        role: OPERATION_ROLE,
        // 하위유형마다 **그 칸의 지금 값**을 싣는다 — 적용 시 경합은 칸 단위로 본다.
        prev_assignee: c.assignee_email,
        next_assignee: m.next_assignee,
        reason: m.reason,
      });
    }
  }

  const admin = createAdminClient();
  const { data: batch, error: batchErr } = await admin
    .from("assignment_proposal_batches")
    .insert({
      academic_year: input.academicYear,
      kind: input.kind,
      status: "pending",
      requested_by: input.requestedBy,
      basis: buildBasis(input),
      summary,
    })
    .select("id")
    .maybeSingle();
  if (batchErr || !batch) {
    return {
      ok: false,
      error: `제안 배치 적재 실패: ${batchErr?.message ?? "행이 돌아오지 않았습니다"}`,
    };
  }
  const batchId = batch.id as string;

  if (proposalRows.length > 0) {
    const { error: propErr } = await admin
      .from("assignment_proposals")
      .insert(proposalRows.map((r) => ({ ...r, batch_id: batchId })));
    if (propErr) {
      // **반쪽 상태를 갈라 말한다.** '실패' 로만 말하면 다시 돌려 빈 배치가 둘 쌓인다.
      return {
        ok: false,
        error: `배치(${batchId})는 만들어졌지만 제안 적재가 실패했습니다: ${propErr.message}`,
      };
    }
  }

  return {
    ok: true,
    batchId,
    proposals: proposalRows.length,
    rejected: input.gateResult.rejected.length,
    summary,
  };
}
