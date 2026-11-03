import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: () => Promise.resolve("tok"),
}));

const { currentSheetName } = await import("../queries");

/**
 * 시트는 회계연도다 — 4월에 시작한다. `2025` 시트가 2026-03-26 에 끝나고 `2026` 은
 * 2026년 4월부터다. 달력 연도로 고르면 1~3월에 아직 없는 시트를 찾는다.
 */
describe("currentSheetName — 회계연도(4월 시작) 시트", () => {
  it("3월 31일 23:59 KST 는 아직 전년도 시트다", () => {
    expect(currentSheetName(new Date("2026-03-31T14:59:00Z"))).toBe("2025");
  });

  it("4월 1일 00:00 KST 부터 그해 시트다", () => {
    expect(currentSheetName(new Date("2026-03-31T15:00:00Z"))).toBe("2026");
  });

  it("11월은 그해 시트다", () => {
    expect(currentSheetName(new Date("2026-11-03T03:00:00Z"))).toBe("2026");
  });

  it("1월은 전년도 시트다 — 달력 연도로 고르면 아직 없는 시트를 찾는다", () => {
    expect(currentSheetName(new Date("2027-01-15T03:00:00Z"))).toBe("2026");
  });

  it("다음 해 4월 1일 KST 에 새 시트로 넘어간다", () => {
    expect(currentSheetName(new Date("2027-03-31T15:00:00Z"))).toBe("2027");
  });
});
