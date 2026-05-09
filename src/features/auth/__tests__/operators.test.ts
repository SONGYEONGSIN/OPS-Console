import { describe, it, expect } from "vitest";
import { OPERATORS, tenureYears, tenureLabel, ageOf } from "../operators";

describe("OPERATORS", () => {
  it("17명 정의 (운영1팀 8 + 운영2팀 9)", () => {
    expect(OPERATORS.length).toBe(17);
    const t1 = OPERATORS.filter((o) => o.team === "운영1팀");
    const t2 = OPERATORS.filter((o) => o.team === "운영2팀");
    expect(t1.length).toBe(8);
    expect(t2.length).toBe(9);
  });

  it("모든 operator는 empNo / hiredAt / birthDate / gender 필드 가짐", () => {
    for (const op of OPERATORS) {
      expect(op.empNo).toMatch(/^\w+$/);
      expect(op.hiredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(op.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["남", "여"]).toContain(op.gender);
      expect(op.division).toBe("어플라이사업본부");
      expect(op.department).toBe("운영부");
    }
  });

  it("송영신은 운영2팀 팀장", () => {
    const ys = OPERATORS.find((o) => o.email === "ys1114@jinhakapply.com");
    expect(ys?.team).toBe("운영2팀");
    expect(ys?.role).toBe("팀장");
  });
});

describe("tenureYears", () => {
  it("2008-06-01 입사, 2026-05-09 기준 — 약 17.94년", () => {
    const base = new Date("2026-05-09T00:00:00+09:00");
    const yrs = tenureYears("2008-06-01", base);
    expect(yrs).toBeGreaterThan(17.9);
    expect(yrs).toBeLessThan(18.0);
  });
});

describe("tenureLabel", () => {
  it("2024-05-02 입사, 2026-05-09 기준 → '2년 0개월'", () => {
    const base = new Date("2026-05-09T00:00:00+09:00");
    expect(tenureLabel("2024-05-02", base)).toBe("2년 0개월");
  });

  it("2008-06-01 입사, 2026-05-09 기준 → '17년 11개월'", () => {
    const base = new Date("2026-05-09T00:00:00+09:00");
    expect(tenureLabel("2008-06-01", base)).toBe("17년 11개월");
  });
});

describe("ageOf", () => {
  it("1982-10-06 출생, 2026-05-09 기준 → 만 43세", () => {
    const base = new Date("2026-05-09T00:00:00+09:00");
    expect(ageOf("1982-10-06", base)).toBe(43);
  });
});
