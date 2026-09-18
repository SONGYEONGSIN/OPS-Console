import { describe, it, expect } from "vitest";
import {
  planApply,
  type ApplyLedgerCell,
  type ApplyProposal,
} from "../apply-plan";

/**
 * 제안 적용의 판정 — **제안은 적용 전까지 사실이 아니다**(설계 §5.4).
 *
 * 제안을 만든 뒤 사람이 손으로 고쳤을 수 있다. `prev_assignee` 가 지금 원장의 값과
 * 다르면 그 행은 적용하지 않고 '그 사이 바뀜' 으로 표시한다(F8) — 덮어쓰면 사람이
 * 방금 내린 결정을 에이전트의 옛 판정이 지운다.
 */
const proposal = (
  over: Partial<ApplyProposal> & { id: string },
): ApplyProposal => ({
  academic_year: 2027,
  university_name: "가대",
  work_kind: "원서접수",
  subtype: "",
  role: "운영",
  prev_assignee: "a@x.com",
  next_assignee: "b@x.com",
  ...over,
});

const cell = (over: Partial<ApplyLedgerCell> = {}): ApplyLedgerCell => ({
  academic_year: 2027,
  university_name: "가대",
  work_kind: "원서접수",
  subtype: "",
  role: "운영",
  assignee_email: "a@x.com",
  ...over,
});

describe("planApply", () => {
  it("원장 값이 제안의 이전 담당자와 같으면 적용한다", () => {
    const plan = planApply([proposal({ id: "p1" })], [cell()]);
    expect(plan.apply).toHaveLength(1);
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.apply[0].next_assignee).toBe("b@x.com");
  });

  it("그 사이 바뀐 칸은 적용하지 않는다", () => {
    const plan = planApply(
      [proposal({ id: "p1" })],
      [cell({ assignee_email: "c@x.com" })],
    );
    expect(plan.apply).toHaveLength(0);
    expect(plan.conflicts).toEqual([
      { id: "p1", reason: expect.stringMatching(/그 사이 바뀜/) },
    ]);
  });

  it("원장에서 칸이 사라졌으면 적용하지 않는다", () => {
    const plan = planApply([proposal({ id: "p1" })], []);
    expect(plan.apply).toHaveLength(0);
    expect(plan.conflicts[0].reason).toMatch(/칸/);
  });

  it("미배정이던 칸도 적용한다 — null 과 null 은 같다", () => {
    const plan = planApply(
      [proposal({ id: "p1", prev_assignee: null })],
      [cell({ assignee_email: null })],
    );
    expect(plan.apply).toHaveLength(1);
  });

  it("비어 있던 칸에 누가 들어왔으면 경합이다", () => {
    const plan = planApply(
      [proposal({ id: "p1", prev_assignee: null })],
      [cell({ assignee_email: "c@x.com" })],
    );
    expect(plan.conflicts).toHaveLength(1);
  });

  it("이미 제안한 사람이 앉아 있으면 적용할 것이 없다", () => {
    // 손으로 먼저 같은 결정을 내린 경우다. 경합으로 부르면 관리자가 원장을 뒤진다.
    const plan = planApply(
      [proposal({ id: "p1" })],
      [cell({ assignee_email: "b@x.com" })],
    );
    expect(plan.apply).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.alreadyDone).toEqual(["p1"]);
  });

  it("하위유형·역할까지 맞춰 칸을 찾는다", () => {
    // 자연키에 넷이 다 있다. 업무종류까지만 보면 수시 제안이 정시 칸을 덮는다.
    const plan = planApply(
      [proposal({ id: "p1", subtype: "정시" })],
      [
        cell({ subtype: "수시", assignee_email: "z@x.com" }),
        cell({ subtype: "정시" }),
      ],
    );
    expect(plan.apply).toHaveLength(1);
    expect(plan.apply[0].subtype).toBe("정시");
  });

  it("학년도가 다른 칸을 집지 않는다", () => {
    const plan = planApply(
      [proposal({ id: "p1" })],
      [cell({ academic_year: 2026 })],
    );
    expect(plan.apply).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(1);
  });

  it("여러 줄을 함께 판정하고 섞인 결과를 돌려준다", () => {
    const plan = planApply(
      [
        proposal({ id: "p1" }),
        proposal({ id: "p2", subtype: "정시", prev_assignee: "a@x.com" }),
      ],
      [cell(), cell({ subtype: "정시", assignee_email: "c@x.com" })],
    );
    expect(plan.apply.map((a) => a.id)).toEqual(["p1"]);
    expect(plan.conflicts.map((c) => c.id)).toEqual(["p2"]);
  });

  it("새 담당자가 없는 제안은 만들지 않는다", () => {
    // `next_assignee` 는 not null 이다. 빈 문자열이 오면 원장을 비우는 쓰기가 된다.
    const plan = planApply(
      [proposal({ id: "p1", next_assignee: "" })],
      [cell()],
    );
    expect(plan.apply).toHaveLength(0);
    expect(plan.conflicts[0].reason).toMatch(/담당자/);
  });
});
