import { describe, it, expect } from "vitest";
import {
  cycleRowSchema,
  cycleStatusSchema,
  assignmentRowSchema,
  goalRowSchema,
  planRowSchema,
  reviewRowSchema,
  STEP_VALUES,
  ROLE_VALUES,
  GRADE_VALUES,
  GRADE_DESCRIPTION_PERFORMANCE,
  GRADE_DESCRIPTION_COMPETENCY,
  metricCreateSchema,
} from "../schemas";

describe("performance schemas — enums", () => {
  it.each(["open", "closed"] as const)("cycleStatus '%s' 유효", (s) => {
    expect(cycleStatusSchema.parse(s)).toBe(s);
  });

  it("cycleStatus 'archived' — reject", () => {
    expect(() => cycleStatusSchema.parse("archived")).toThrow();
  });

  it("STEP_VALUES = [1..4]", () => {
    expect(STEP_VALUES).toEqual([1, 2, 3, 4]);
  });

  it("ROLE_VALUES = ['evaluator','evaluatee']", () => {
    expect(ROLE_VALUES).toEqual(["evaluator", "evaluatee"]);
  });

  it("GRADE_VALUES = S/A/B/C/D", () => {
    expect(GRADE_VALUES).toEqual(["S", "A", "B", "C", "D"]);
  });

  it("GRADE_DESCRIPTION_PERFORMANCE/COMPETENCY — 각 5건, 문구 비어있지 않음", () => {
    for (const g of GRADE_VALUES) {
      expect(GRADE_DESCRIPTION_PERFORMANCE[g]).toMatch(/[가-힣]/);
      expect(GRADE_DESCRIPTION_COMPETENCY[g]).toMatch(/[가-힣]/);
    }
  });
});

describe("cycleRowSchema", () => {
  const valid = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "2026 상반기",
    status: "open" as const,
    created_at: "2026-05-25T00:00:00Z",
    updated_at: "2026-05-25T00:00:00Z",
  };
  it("유효 row — parse 성공", () => {
    expect(cycleRowSchema.parse(valid).name).toBe("2026 상반기");
  });
  it("name 빈 문자 — reject", () => {
    expect(() => cycleRowSchema.parse({ ...valid, name: "" })).toThrow();
  });
});

describe("assignmentRowSchema", () => {
  const valid = {
    id: "22222222-2222-4222-8222-222222222222",
    cycle_id: "11111111-1111-4111-8111-111111111111",
    evaluator_email: "lead@example.com",
    evaluatee_email: "member@example.com",
    current_step: 1,
    created_at: "2026-05-25T00:00:00Z",
    updated_at: "2026-05-25T00:00:00Z",
  };
  it("current_step 1 — parse 성공", () => {
    expect(assignmentRowSchema.parse(valid).current_step).toBe(1);
  });
  it("current_step 4 — parse 성공", () => {
    expect(
      assignmentRowSchema.parse({ ...valid, current_step: 4 }).current_step,
    ).toBe(4);
  });
  it("current_step 0 — reject (범위 1-4)", () => {
    expect(() =>
      assignmentRowSchema.parse({ ...valid, current_step: 0 }),
    ).toThrow();
  });
  it("current_step 9 — reject (범위 1-8)", () => {
    expect(() =>
      assignmentRowSchema.parse({ ...valid, current_step: 9 }),
    ).toThrow();
  });
  it("evaluator_email 잘못된 형식 — reject", () => {
    expect(() =>
      assignmentRowSchema.parse({ ...valid, evaluator_email: "no-at-sign" }),
    ).toThrow();
  });
});

describe("goalRowSchema", () => {
  const valid = {
    id: "33333333-3333-4333-8333-333333333333",
    assignment_id: "22222222-2222-4222-8222-222222222222",
    title: "원서접수 안정 운영",
    body: "PIMS 포함 149+152 서비스 무중단",
    weight: 0.4,
    created_at: "2026-05-25T00:00:00Z",
  };
  it("weight 0.4 — parse 성공", () => {
    expect(goalRowSchema.parse(valid).weight).toBe(0.4);
  });
  it("weight 1 — parse 성공 (경계)", () => {
    expect(goalRowSchema.parse({ ...valid, weight: 1 }).weight).toBe(1);
  });
  it("weight 1.5 — reject (0-1 초과)", () => {
    expect(() => goalRowSchema.parse({ ...valid, weight: 1.5 })).toThrow();
  });
  it("weight -0.1 — reject (음수)", () => {
    expect(() => goalRowSchema.parse({ ...valid, weight: -0.1 })).toThrow();
  });
});

describe("planRowSchema", () => {
  const valid = {
    id: "44444444-4444-4444-8444-444444444444",
    goal_id: "33333333-3333-4333-8333-333333333333",
    body: "Q1 안정성 점검 + Q2 PIMS 마이그",
    created_at: "2026-05-25T00:00:00Z",
    updated_at: "2026-05-25T00:00:00Z",
  };
  it("유효 row — parse 성공", () => {
    expect(planRowSchema.parse(valid).body).toMatch(/PIMS/);
  });
});

describe("reviewRowSchema — step/role/grade 매트릭스", () => {
  const base = {
    id: "55555555-5555-4555-8555-555555555555",
    assignment_id: "22222222-2222-4222-8222-222222222222",
    body: "검토 의견",
    score: null,
    grade_performance: null,
    grade_competency: null,
    created_at: "2026-05-25T00:00:00Z",
  };
  it("step=3 + role=evaluator — 유효", () => {
    expect(
      reviewRowSchema.parse({ ...base, step: 3, role: "evaluator" }).step,
    ).toBe(3);
  });
  it("step=4 + role=evaluatee — 유효", () => {
    expect(
      reviewRowSchema.parse({ ...base, step: 4, role: "evaluatee" }).role,
    ).toBe("evaluatee");
  });
  it("step=2 — reject (3-7만 review row)", () => {
    expect(() =>
      reviewRowSchema.parse({ ...base, step: 2, role: "evaluator" }),
    ).toThrow();
  });
  it("step=7 + grade_performance='S' + grade_competency='A' — 유효 (종합평가)", () => {
    const row = reviewRowSchema.parse({
      ...base,
      step: 7,
      role: "evaluator",
      grade_performance: "S",
      grade_competency: "A",
    });
    expect(row.grade_performance).toBe("S");
    expect(row.grade_competency).toBe("A");
  });
  it("grade_performance 'X' — reject (S/A/B/C/D만)", () => {
    expect(() =>
      reviewRowSchema.parse({
        ...base,
        step: 7,
        role: "evaluator",
        grade_performance: "X",
      }),
    ).toThrow();
  });
});

/**
 * 목표 기반 지표 — 목표값이 있어야 달성률을 계산할 수 있다.
 * 없던 시절엔 사람이 달성률을 손으로 넣었다.
 */
describe("metricCreateSchema — 목표", () => {
  const base = {
    assignment_id: "11111111-1111-4111-8111-111111111111",
    name: "지표",
    weight: 20,
  };

  it("목표값·단위·방향을 받는다", () => {
    const r = metricCreateSchema.safeParse({
      ...base,
      target_value: 30,
      unit: "건",
      lower_is_better: true,
    });
    expect(r.success).toBe(true);
  });

  it("목표를 안 넣어도 된다 — 수동 지표는 목표 없이 쓰던 대로 둔다", () => {
    expect(metricCreateSchema.safeParse(base).success).toBe(true);
  });

  /**
   * 목표 0 은 나눌 수 없다. 화면에서 막지 않으면 달성률이 조용히 null 이 되고
   * 그 지표는 영영 0점으로 남는다.
   */
  it("목표 0 은 거절한다 — 나눌 수 없다", () => {
    const r = metricCreateSchema.safeParse({ ...base, target_value: 0 });
    expect(r.success).toBe(false);
  });

  it("음수 목표도 거절한다", () => {
    expect(
      metricCreateSchema.safeParse({ ...base, target_value: -5 }).success,
    ).toBe(false);
  });
});
