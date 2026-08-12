import { describe, it, expect } from "vitest";
import {
  OPERATORS,
  tenureYears,
  tenureLabel,
  ageOf,
  operatorNameByEmail,
} from "../operators";

describe("OPERATORS", () => {
  it("실 인사 18명 — 운영부 17명(운영1팀 8 + 운영2팀 9) + 타 부서 1명", () => {
    // 임시 테스트 계정(@gmail)을 제외한 실 인사만 검증 — 정원 무결성.
    // 실 인사 이메일 도메인은 @jinhakapply.com / @jinhak.com 혼재(#668 정정)하므로
    // 도메인 화이트리스트가 아닌 @gmail 테스트 계정 제외로 판별한다.
    //
    // 이 목록은 원래 운영부 조직도였으나, 미수채권 담당으로 시트에 등장하는 타 부서 인원도
    // 등재한다 — 학교담당자 독려 메일이 담당자 이름→이메일을 여기서 찾기 때문이다.
    // (명단에 없으면 그 담당자의 미수건은 모든 마일스톤에서 조용히 제외된다.)
    const real = OPERATORS.filter((o) => !o.email.endsWith("@gmail.com"));
    expect(real.length).toBe(18);
    const ops = real.filter((o) => o.department === "운영부");
    expect(ops.length).toBe(17);
    expect(ops.filter((o) => o.team === "운영1팀").length).toBe(8);
    expect(ops.filter((o) => o.team === "운영2팀").length).toBe(9);
    // 운영부 인원은 반드시 운영1/2팀 중 하나 — 부서와 팀이 어긋나면 안 된다.
    expect(ops.every((o) => o.team === "운영1팀" || o.team === "운영2팀")).toBe(
      true,
    );
  });

  it("기획팀은 운영부가 아니라 본부장 직속", () => {
    // 팀 뉴스레터의 생일·근속 기념일은 department='운영부'로 걸러진다(team-briefing.ts).
    // 이 짝이 깨지면 타 부서 인원이 운영부 소식지에 실린다.
    for (const op of OPERATORS.filter((o) => o.team === "기획팀")) {
      expect(op.department).toBe("본부장 직속");
    }
  });

  it("모든 operator는 empNo / hiredAt / birthDate / gender 필드 가짐", () => {
    for (const op of OPERATORS) {
      expect(op.empNo).toMatch(/^\w+$/);
      expect(op.hiredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(op.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["남", "여"]).toContain(op.gender);
      expect(op.division).toBe("어플라이사업본부");
      expect(["운영부", "본부장 직속"]).toContain(op.department);
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

describe("operatorNameByEmail", () => {
  it("등록된 이메일 → 운영자 이름", () => {
    expect(operatorNameByEmail("ys1114@jinhakapply.com")).toBe("송영신");
  });
  it("미등록 이메일 → local-part fallback", () => {
    expect(operatorNameByEmail("unknown@example.com")).toBe("unknown");
  });
  it("빈/누락 값 → 빈 문자열", () => {
    expect(operatorNameByEmail("")).toBe("");
    expect(operatorNameByEmail(null)).toBe("");
    expect(operatorNameByEmail(undefined)).toBe("");
  });
});
