import { describe, it, expect } from "vitest";
import { isReceivablesDataCells } from "../sheet-row";

describe("isReceivablesDataCells", () => {
  it("합계/소계/총계 행 제외", () => {
    expect(
      isReceivablesDataCells(["합계", "", "69,537,750"], "2026-05-06"),
    ).toBe(false);
    expect(isReceivablesDataCells(["", "소 계", "100"], "2026-05-06")).toBe(
      false,
    );
  });

  it("청구일자 빈 행 제외", () => {
    expect(isReceivablesDataCells(["서울대", "1,000"], "")).toBe(false);
    expect(isReceivablesDataCells(["서울대", "1,000"], "  ")).toBe(false);
  });

  it("일반 데이터 행은 통과", () => {
    expect(isReceivablesDataCells(["서울대", "1,000"], "2026-05-06")).toBe(
      true,
    );
  });
});
