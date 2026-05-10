import { describe, it, expect } from "vitest";
import {
  cohortStatusSchema,
  cohortRowSchema,
  cohortCreateSchema,
  cohortUpdateSchema,
} from "../schemas";

describe("cohort status enum", () => {
  it.each(["planned", "in_progress", "completed"] as const)("%s — 유효", (s) => {
    expect(cohortStatusSchema.parse(s)).toBe(s);
  });

  it("알 수 없는 status — reject", () => {
    expect(() => cohortStatusSchema.parse("done")).toThrow();
  });
});

describe("cohortCreateSchema", () => {
  const valid = {
    title: "2026 Q2 신입 — 김지나",
    trainee_email: "kjn@jinhakapply.com",
    mentor_email: "ys1114@jinhakapply.com",
    start_date: "2026-05-14",
    end_date: "2026-05-25",
    status: "in_progress" as const,
    notes: null,
  };

  it("유효 입력 — parse 성공", () => {
    expect(cohortCreateSchema.parse(valid).title).toBe(valid.title);
  });

  it("title 빈 — reject", () => {
    expect(() =>
      cohortCreateSchema.parse({ ...valid, title: "" }),
    ).toThrow();
  });

  it("status 생략 — default 'planned'", () => {
    const { status: _omit, ...rest } = valid;
    expect(cohortCreateSchema.parse(rest).status).toBe("planned");
  });

  it("end_date 생략 — 허용", () => {
    const { end_date: _omit, ...rest } = valid;
    expect(cohortCreateSchema.parse(rest).end_date ?? null).toBeNull();
  });

  it("mentor_email 생략 — 허용 (사수 미정)", () => {
    const { mentor_email: _omit, ...rest } = valid;
    expect(cohortCreateSchema.parse(rest).mentor_email ?? null).toBeNull();
  });

  it("trainee_email 잘못된 형식 — reject", () => {
    expect(() =>
      cohortCreateSchema.parse({ ...valid, trainee_email: "x" }),
    ).toThrow();
  });
});

describe("cohortRowSchema", () => {
  it("DB row parse", () => {
    const row = {
      id: "a1b2c3d4-1234-4567-89ab-123456789012",
      title: "회차 1",
      trainee_email: "kjn@jinhakapply.com",
      mentor_email: null,
      start_date: "2026-05-14",
      end_date: null,
      status: "planned" as const,
      notes: null,
      created_at: "2026-05-10T15:00:00Z",
      updated_at: "2026-05-10T15:00:00Z",
    };
    expect(cohortRowSchema.parse(row).id).toBe(row.id);
  });
});

describe("cohortUpdateSchema", () => {
  it("부분 업데이트 — status만", () => {
    const parsed = cohortUpdateSchema.parse({ status: "completed" });
    expect(parsed.status).toBe("completed");
  });
});
