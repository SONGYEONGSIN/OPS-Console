import { describe, it, expect } from "vitest";
import { orgGoalUpsertSchema } from "../org-goal-schema";

const base = {
  scope: "team" as const,
  owner_name: "운영1팀",
  period_start: "2026-03-01",
  period_end: "2027-02-28",
  title: "마감 완수 300건",
};

/**
 * 조직 목표는 여러 사람의 달성률을 좌우한다 — 잘못 들어간 값 하나가
 * 팀 전체 리포트를 틀리게 만든다. 폼을 믿지 않고 스키마에서 막는다.
 */
describe("orgGoalUpsertSchema", () => {
  it("최소 입력이면 통과한다", () => {
    expect(orgGoalUpsertSchema.safeParse(base).success).toBe(true);
  });

  /** target 0 은 나눌 수 없어 달성률이 null 이 된다 — 등록 단계에서 막는다. */
  it("목표값 0 은 막는다 — 나눌 수 없다", () => {
    const r = orgGoalUpsertSchema.safeParse({ ...base, target_value: 0 });
    expect(r.success).toBe(false);
  });

  it("목표값은 비워도 된다 — 세는 지표가 아닌 목표가 있다", () => {
    expect(
      orgGoalUpsertSchema.safeParse({ ...base, target_value: null }).success,
    ).toBe(true);
  });

  /** 끝이 시작보다 앞서면 기간 안에 아무것도 안 들어와 실적이 늘 0 이 된다. */
  it("종료가 시작보다 앞서면 막는다", () => {
    const r = orgGoalUpsertSchema.safeParse({
      ...base,
      period_start: "2027-02-28",
      period_end: "2026-03-01",
    });
    expect(r.success).toBe(false);
  });

  it("scope 는 본부·팀 둘뿐 — 개인은 개인 목표가 담는다", () => {
    expect(
      orgGoalUpsertSchema.safeParse({ ...base, scope: "person" }).success,
    ).toBe(false);
  });

  it("제목이 비면 막는다 — 무엇이 목표인지 모른다", () => {
    expect(orgGoalUpsertSchema.safeParse({ ...base, title: "" }).success).toBe(
      false,
    );
  });
});
