import { describe, expect, it } from "vitest";
import {
  conditionLine,
  matchesRatioAuditFilters,
  ratioAuditFiltersSchema,
  ratioFilterLabel,
  type RatioAuditFilters,
  type RatioRecruit,
  type RatioUniv,
} from "../run-filters";

const row = (university_type: string | null, category: string | null) => ({
  university_type,
  category,
});
const F = (univ: RatioUniv[], recruit: RatioRecruit[]): RatioAuditFilters => ({
  univ,
  recruit,
});

describe("실행 조건 판정 규칙", () => {
  it.each([
    ["2년제", "수시", true],
    ["전문대", "수시", true],
    [" 2년제 ", "수시", true],
    ["4년제", "수시", false],
    ["대학원", "수시", false],
    ["초중고교", "수시", false],
    ["기타", "수시", false],
    ["학위취득", "수시", false],
    [null, "수시", false],
  ])("2년제·수시 — 대학구분 %s / %s → %s", (u, c, ok) =>
    expect(matchesRatioAuditFilters(row(u, c), F(["2년제"], ["수시"]))).toBe(ok),
  );

  it.each([
    ["수시", true],
    [" 수시 ", true],
    ["수시 재외국민", false],
    ["정시", false],
    [null, false],
  ])("수시는 정확히 — %s → %s", (c, ok) =>
    expect(matchesRatioAuditFilters(row("4년제", c), F(["4년제"], ["수시"]))).toBe(ok),
  );

  it.each([
    ["정시", true],
    ["정시 가나다", true],
    ["정시 나다", true],
    ["정시 가다", true],
    ["정시 나", true],
    ["정시 다", true],
    ["수시", false],
    ["추가모집", false],
    [null, false],
  ])("정시는 접두 — %s → %s", (c, ok) =>
    expect(matchesRatioAuditFilters(row("4년제", c), F(["4년제"], ["정시"]))).toBe(ok),
  );

  it("두 묶음 모두 맞아야 한다(교집합)", () => {
    expect(matchesRatioAuditFilters(row("4년제", "정시 나"), F(["2년제"], ["정시"]))).toBe(false);
    expect(
      matchesRatioAuditFilters(row("4년제", "정시 나"), F(["4년제", "2년제"], ["수시", "정시"])),
    ).toBe(true);
  });
});

describe("실행 조건 스키마", () => {
  it("하나 이상 골라야 한다 — 문구 그대로", () => {
    const r = ratioAuditFiltersSchema.safeParse({ univ: [], recruit: ["수시"] });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toBe("대학구분을 하나 이상 고르세요.");
    expect(
      ratioAuditFiltersSchema.safeParse({ univ: ["4년제"], recruit: [] }).error!.issues[0].message,
    ).toBe("모집구분을 하나 이상 고르세요.");
  });

  it("허용값 밖은 거절", () => {
    const univ = ratioAuditFiltersSchema.safeParse({ univ: ["전문대"], recruit: ["수시"] });
    expect(univ.success).toBe(false); // 화면 선택지는 4년제/2년제 뿐
    expect(univ.error!.issues[0].message).toBe("대학구분 값이 올바르지 않습니다.");
    const recruit = ratioAuditFiltersSchema.safeParse({
      univ: ["4년제"],
      recruit: ["수시 재외국민"],
    });
    expect(recruit.success).toBe(false);
    expect(recruit.error!.issues[0].message).toBe("모집구분 값이 올바르지 않습니다.");
    expect(ratioAuditFiltersSchema.safeParse(null).success).toBe(false); // 옛 요청의 filters
  });

  it("중복 제거 + 화면 순서", () => {
    expect(
      ratioAuditFiltersSchema.parse({ univ: ["2년제", "4년제", "2년제"], recruit: ["정시", "수시"] }),
    ).toEqual({ univ: ["4년제", "2년제"], recruit: ["수시", "정시"] });
  });
});

describe("조건 문구", () => {
  it("라벨과 조건 한 줄", () => {
    expect(ratioFilterLabel(F(["2년제"], ["수시"]))).toBe("2년제 · 수시 · 접수 마감 전");
    expect(conditionLine(F(["4년제", "2년제"], ["수시", "정시"]), 120)).toBe(
      "조건: 4년제, 2년제 · 수시, 정시 · 접수 마감 전 — 대상 120건",
    );
    expect(conditionLine(F(["2년제"], ["정시"]), 0)).toBe(
      "조건: 2년제 · 정시 · 접수 마감 전 — 대상 0건",
    );
  });
});
