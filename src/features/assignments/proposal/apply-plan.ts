/**
 * 제안 적용의 **판정** — 무엇을 쓰고 무엇을 건너뛸지 정한다(설계 §5.4 · F8).
 *
 * 순수 함수로 가른 이유는 여기가 유일하게 틀리면 안 되는 자리이기 때문이다. 제안은
 * 적용 전까지 사실이 아니고, 만든 뒤 사람이 손으로 고쳤을 수 있다. `prev_assignee` 가
 * 지금 원장의 값과 다르면 덮어쓰지 않는다 — 덮으면 사람이 방금 내린 결정을 에이전트의
 * 옛 판정이 말없이 지운다.
 */

/** 원장 자연키 — 넷이 다 있어야 칸이 하나로 정해진다. */
const keyOf = (v: {
  academic_year: number;
  university_name: string;
  work_kind: string;
  subtype: string;
  role: string;
}) =>
  [v.academic_year, v.university_name, v.work_kind, v.subtype, v.role].join(
    "|",
  );

export type ApplyProposal = {
  id: string;
  academic_year: number;
  university_name: string;
  work_kind: string;
  subtype: string;
  role: string;
  /** 제안 시점의 확정값. 지금 원장과 다르면 경합이다. */
  prev_assignee: string | null;
  next_assignee: string;
};

export type ApplyLedgerCell = {
  academic_year: number;
  university_name: string;
  work_kind: string;
  subtype: string;
  role: string;
  assignee_email: string | null;
};

export type ApplyConflict = { id: string; reason: string };

export type ApplyPlan = {
  /** 이대로 쓰면 되는 줄. */
  apply: ApplyProposal[];
  /** 쓰지 않는 줄과 그 이유 — 화면의 `그 사이 바뀜` 배지가 이걸 읽는다. */
  conflicts: ApplyConflict[];
  /**
   * 이미 그 사람이 앉아 있는 줄. 사람이 손으로 먼저 같은 결정을 내린 경우다 —
   * 경합으로 부르면 관리자가 원장을 뒤지는데 볼 것이 없다.
   */
  alreadyDone: string[];
};

export function planApply(
  proposals: readonly ApplyProposal[],
  ledger: readonly ApplyLedgerCell[],
): ApplyPlan {
  const byKey = new Map(ledger.map((c) => [keyOf(c), c]));

  const plan: ApplyPlan = { apply: [], conflicts: [], alreadyDone: [] };
  for (const p of proposals) {
    // `next_assignee` 가 비면 원장을 비우는 쓰기가 된다 — 제안이 할 일이 아니다.
    if (!p.next_assignee) {
      plan.conflicts.push({ id: p.id, reason: "제안에 담당자가 없습니다" });
      continue;
    }

    const cell = byKey.get(keyOf(p));
    if (!cell) {
      plan.conflicts.push({ id: p.id, reason: "원장에서 칸이 사라졌습니다" });
      continue;
    }

    const now = cell.assignee_email;
    if (now === p.next_assignee) {
      plan.alreadyDone.push(p.id);
      continue;
    }
    if (now !== p.prev_assignee) {
      plan.conflicts.push({
        id: p.id,
        reason: "그 사이 바뀜 — 제안을 만든 뒤 이 칸이 바뀌었습니다",
      });
      continue;
    }
    plan.apply.push(p);
  }
  return plan;
}
