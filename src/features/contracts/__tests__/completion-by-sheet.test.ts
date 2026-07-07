import { describe, it, expect } from "vitest";
import { tallyBySheet, completionRate } from "../completion";
import { CONTRACT_SHEETS } from "../schemas";

describe("completionRate", () => {
  it("완료/전체 백분율 (소수 1자리 반올림)", () => {
    expect(completionRate(129, 148)).toBe(87.2);
    expect(completionRate(1, 3)).toBe(33.3);
    expect(completionRate(50, 50)).toBe(100);
  });

  it("전체 0이면 null (0 나눗셈 방지)", () => {
    expect(completionRate(0, 0)).toBeNull();
  });
});

describe("tallyBySheet", () => {
  it("시트별 완료/전체 건수를 CONTRACT_SHEETS 순서로 집계", () => {
    const rows = [
      { sheet: "4년제" as const, status: "계약완료" },
      { sheet: "4년제" as const, status: "계약완료(영업)" },
      { sheet: "4년제" as const, status: "미완료" },
      { sheet: "전문대" as const, status: "체결완료" },
      { sheet: "초중고" as const, status: "" },
      { sheet: "대학원" as const, status: "계약완료" },
    ];
    const result = tallyBySheet(rows, CONTRACT_SHEETS);
    expect(result).toEqual([
      { sheet: "4년제", completed: 2, total: 3 },
      { sheet: "전문대", completed: 1, total: 1 },
      { sheet: "초중고", completed: 0, total: 1 },
      { sheet: "대학원", completed: 1, total: 1 },
      { sheet: "기타", completed: 0, total: 0 },
    ]);
  });

  it("빈 입력 시 모든 시트 완료/전체 0", () => {
    const result = tallyBySheet([], CONTRACT_SHEETS);
    expect(result.every((r) => r.completed === 0 && r.total === 0)).toBe(true);
    expect(result).toHaveLength(CONTRACT_SHEETS.length);
  });

  it("완료 합계는 완료 행 총합과 일치", () => {
    const rows = [
      { sheet: "4년제" as const, status: "계약완료" },
      { sheet: "전문대" as const, status: "계약완료" },
      { sheet: "기타" as const, status: "미완료" },
    ];
    const completed = tallyBySheet(rows, CONTRACT_SHEETS).reduce(
      (s, r) => s + r.completed,
      0,
    );
    expect(completed).toBe(2);
  });
});
