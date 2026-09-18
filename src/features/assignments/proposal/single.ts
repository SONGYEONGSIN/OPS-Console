import { workKey, type WorkloadOperator } from "../workload";
import { ledgerHolders, type GateLedgerCell } from "./gate";

/**
 * 단건 배정 — 관리자가 서비스 하나를 지목했을 때(§6.3).
 *
 * **후보가 좁아 에이전트 없이 끝나는 경우가 많다.** 같은 대학·같은 업무종류를 이미
 * 맡은 사람이 있으면 그 사람이다 — 대학 담당자와의 관계가 자산이라(§6.1 λ) 새
 * 서비스를 남에게 주는 것이 오히려 비용이다.
 *
 * **추측해 채우지 않는다.** 배정 대상이 없으면 미배정으로 두고 보고한다. 아무나
 * 넣으면 그 사람은 자기 것이 된 줄 모르고, 아무도 안 본 서비스가 오픈한다.
 */

export type SingleAssignment =
  /** 에이전트 없이 끝났다. */
  | { kind: "assign"; assignee_email: string; reason: string }
  /** 에이전트에게 물어야 한다. */
  | { kind: "ask" }
  /** 채우지 않고 보고한다. */
  | { kind: "unassigned"; reason: string };

/** 상담앱은 자동 배정 대상이 아니다 — 화면에는 보이되 제안을 만들지 않는다(결정 6). */
const EXCLUDED_WORK_KINDS = new Set(["상담앱"]);

export function assignSingle(
  target: { university_name: string; work_kind: string },
  ctx: {
    operators: readonly WorkloadOperator[];
    ledger: readonly GateLedgerCell[];
  },
): SingleAssignment {
  if (EXCLUDED_WORK_KINDS.has(target.work_kind)) {
    return {
      kind: "unassigned",
      reason: `${target.work_kind}은 자동 배정 대상이 아닙니다`,
    };
  }

  const assignable = ctx.operators.filter((o) => o.assignable);
  if (assignable.length === 0) {
    return { kind: "unassigned", reason: "배정 대상인 운영자가 없습니다" };
  }

  const held = ledgerHolders(ctx.ledger).byKey.get(workKey(target));
  // 갈린 칸은 우리가 못 정한다 — 둘 중 누구인지는 사람이 아는 이유가 있다(C4).
  if (!held || held.size !== 1) return { kind: "ask" };

  const [holder] = [...held];
  if (!holder || !assignable.some((o) => o.email === holder)) {
    return { kind: "ask" };
  }

  return {
    kind: "assign",
    assignee_email: holder,
    reason: `${target.university_name}의 ${target.work_kind}을 이미 담당하고 있습니다`,
  };
}
