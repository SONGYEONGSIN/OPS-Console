"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { ASSIGNMENT_NATURAL_KEY } from "../ledger-schemas";
import {
  planApply,
  type ApplyLedgerCell,
  type ApplyProposal,
} from "./apply-plan";

/**
 * 제안 적용·반려 — **마지막 승인은 관리자가 한다**(설계 rev 2).
 *
 * 에이전트가 이상한 답을 내도 원장은 그대로이고 **반려가 기본 선택지**다(R4). 이
 * 파일이 제안이 원장에 닿는 유일한 경로라서, 화면의 가림이 아니라 여기서 권한을
 * 다시 본다.
 *
 * **PostgREST 에는 호출 사이 트랜잭션이 없다.** 원장 → 이력 → 제안 → 배치 순으로
 * 쓴다. 원장이 진실이고 나머지는 부속이므로, 중간에 끊기면 원장이 맞고 표시가
 * 늦는 쪽으로 기운다(PR4b 의 원장·이력 적재와 같은 사정).
 */

const BATCHES = "assignment_proposal_batches";
const PROPOSALS = "assignment_proposals";

export type ApplyProposalResult =
  | { ok: false; error: string }
  | { ok: true; applied: number; conflicted: number; alreadyDone: number };

export type RejectProposalResult = { ok: false; error: string } | { ok: true };

type ProposalRecord = ApplyProposal & { reason: string };

async function requireAdmin(): Promise<
  { ok: true; email: string } | { ok: false; error: string }
> {
  const me = await getCurrentOperator();
  if (!me || me.permission !== "admin") {
    return { ok: false, error: "admin만 제안을 처리할 수 있습니다" };
  }
  return { ok: true, email: me.email };
}

/**
 * 배치를 읽고 **아직 결정되지 않았는지** 확인한다.
 *
 * 두 번 누르면 이력이 두 줄 남고 두 번째 줄은 거짓이다 — 이전값이 이미 바뀌어 있어서,
 * 그걸 되돌리면 엉뚱한 값으로 간다.
 */
async function openBatch(
  admin: ReturnType<typeof createAdminClient>,
  batchId: string,
): Promise<{ ok: true; academicYear: number } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from(BATCHES)
    .select("id, status, academic_year")
    .eq("id", batchId)
    .maybeSingle();
  if (error) return { ok: false, error: `배치 조회 실패: ${error.message}` };
  if (!data) return { ok: false, error: "배치를 찾지 못했습니다" };
  if (data.status !== "pending") {
    return { ok: false, error: `이미 ${data.status} 된 배치입니다` };
  }
  return { ok: true, academicYear: data.academic_year as number };
}

export async function applyProposalBatch(
  batchId: string,
): Promise<ApplyProposalResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const batch = await openBatch(admin, batchId);
  if (!batch.ok) return batch;

  const { data: rows, error: propErr } = await admin
    .from(PROPOSALS)
    .select(
      "id, academic_year, university_name, work_kind, subtype, role, prev_assignee, next_assignee, reason",
    )
    .eq("batch_id", batchId)
    .eq("decision", "pending");
  if (propErr) {
    return { ok: false, error: `제안 조회 실패: ${propErr.message}` };
  }
  const proposals = (rows ?? []) as ProposalRecord[];
  if (proposals.length === 0) {
    return { ok: false, error: "적용할 제안이 없습니다" };
  }

  /**
   * **지금 원장을 읽는다.** 배치의 `prev_assignee` 는 판정 시점의 값이고, 그 뒤에
   * 사람이 손으로 고쳤을 수 있다(F8).
   */
  const { data: cells, error: ledgerErr } = await admin
    .from("assignments")
    .select(
      "academic_year, university_name, work_kind, subtype, role, assignee_email",
    )
    .eq("academic_year", batch.academicYear)
    .in("university_name", [
      ...new Set(proposals.map((p) => p.university_name)),
    ]);
  if (ledgerErr) {
    return { ok: false, error: `원장 조회 실패: ${ledgerErr.message}` };
  }

  const plan = planApply(proposals, (cells ?? []) as ApplyLedgerCell[]);

  if (plan.apply.length > 0) {
    /**
     * 새로 붙는 주소는 **명부에 있어야 한다.** FK 가 `23503` 으로 막지만 그 코드는
     * 사람이 못 읽는다(F14). 이름 스냅샷도 여기서 가져온다 — 판정 시점의 이름을
     * 쓰면 화면이 한 사람을 두 이름으로 부른다.
     */
    const emails = [...new Set(plan.apply.map((p) => p.next_assignee))];
    const { data: ops, error: opErr } = await admin
      .from("operators")
      .select("email, name")
      .in("email", emails);
    if (opErr) {
      return { ok: false, error: `운영자 조회 실패: ${opErr.message}` };
    }
    const nameByEmail = new Map(
      (ops ?? []).map((o) => [o.email as string, (o.name as string) ?? ""]),
    );
    const missing = emails.filter((e) => !nameByEmail.has(e));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `연결 안 됨 — 운영자 명부에 없는 주소입니다: ${missing.join(", ")}`,
      };
    }

    const { error: writeErr } = await admin.from("assignments").upsert(
      plan.apply.map((p) => ({
        academic_year: p.academic_year,
        university_name: p.university_name,
        work_kind: p.work_kind,
        subtype: p.subtype,
        role: p.role,
        assignee_email: p.next_assignee,
        assignee_name: nameByEmail.get(p.next_assignee) ?? "",
        updated_by: auth.email,
      })),
      { onConflict: ASSIGNMENT_NATURAL_KEY.join(",") },
    );
    if (writeErr) {
      return { ok: false, error: `원장 쓰기 실패: ${writeErr.message}` };
    }

    // 출처를 갈라 둔다 — 손편집과 섞이면 "이 칸이 왜 이 사람인가" 를 못 답한다.
    const { error: histErr } = await admin.from("assignment_changes").insert(
      plan.apply.map((p) => ({
        academic_year: p.academic_year,
        university_name: p.university_name,
        work_kind: p.work_kind,
        subtype: p.subtype,
        role: p.role,
        prev_assignee: p.prev_assignee,
        next_assignee: p.next_assignee,
        source: "proposal",
        actor_email: auth.email,
      })),
    );
    if (histErr) {
      return {
        ok: false,
        error: `원장은 들어갔지만 이력 적재가 실패했습니다: ${histErr.message}`,
      };
    }

    const decidedIds = [...plan.apply.map((p) => p.id), ...plan.alreadyDone];
    const { error: markErr } = await admin
      .from(PROPOSALS)
      .update({ decision: "applied", decided_at: new Date().toISOString() })
      .in("id", decidedIds);
    if (markErr) {
      return { ok: false, error: `제안 표시 실패: ${markErr.message}` };
    }
  }

  /**
   * 경합으로 남은 줄이 있으면 배치는 `partial` 이다. 그 줄들은 `pending` 으로 두어
   * 사람이 원장을 보고 다시 판단할 수 있게 한다 — 지우면 왜 안 됐는지가 사라진다.
   */
  const status = plan.conflicts.length === 0 ? "applied" : "partial";
  const { error: batchErr } = await admin
    .from(BATCHES)
    .update({
      status,
      decided_at: new Date().toISOString(),
      decided_by: auth.email,
    })
    .eq("id", batchId);
  if (batchErr) {
    return { ok: false, error: `배치 표시 실패: ${batchErr.message}` };
  }

  revalidatePath("/dashboard/assignments");
  return {
    ok: true,
    applied: plan.apply.length,
    conflicted: plan.conflicts.length,
    alreadyDone: plan.alreadyDone.length,
  };
}

/**
 * 반려 — **원장을 건드리지 않는다.** 제안이 적용 전까지 사실이 아니라는 것이 이
 * 기능의 전부이고, 반려가 기본 선택지다(R4).
 */
export async function rejectProposalBatch(
  batchId: string,
): Promise<RejectProposalResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const batch = await openBatch(admin, batchId);
  if (!batch.ok) return batch;

  const now = new Date().toISOString();
  const { error: propErr } = await admin
    .from(PROPOSALS)
    .update({ decision: "rejected", decided_at: now })
    .eq("batch_id", batchId)
    .eq("decision", "pending");
  if (propErr) {
    return { ok: false, error: `제안 반려 실패: ${propErr.message}` };
  }

  const { error: batchErr } = await admin
    .from(BATCHES)
    .update({ status: "rejected", decided_at: now, decided_by: auth.email })
    .eq("id", batchId);
  if (batchErr) {
    return { ok: false, error: `배치 반려 실패: ${batchErr.message}` };
  }

  revalidatePath("/dashboard/assignments");
  return { ok: true };
}
