import { describe, it, expect } from "vitest";
import { isContractCompleted, prevYm } from "../completion";

describe("isContractCompleted", () => {
  it("완료 상태값을 인식 (변형 포함)", () => {
    expect(isContractCompleted("계약완료")).toBe(true);
    expect(isContractCompleted("체결완료")).toBe(true);
    expect(isContractCompleted("계약완료(영업)")).toBe(true);
    expect(isContractCompleted(" 계약완료 ")).toBe(true);
  });

  it("미완료/진행중/빈값은 false", () => {
    expect(isContractCompleted("계약 미완료")).toBe(false);
    expect(isContractCompleted("영업팀진행")).toBe(false);
    expect(isContractCompleted("")).toBe(false);
  });
});

describe("prevYm", () => {
  it("직전 월 YYYY-MM (연 경계 처리)", () => {
    expect(prevYm("2026-07")).toBe("2026-06");
    expect(prevYm("2026-01")).toBe("2025-12");
    expect(prevYm("2026-10")).toBe("2026-09");
  });
});
