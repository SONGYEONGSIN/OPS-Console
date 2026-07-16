import { describe, it, expect } from "vitest";
import { isPaidReceivableRow } from "../paid-row";

describe("isPaidReceivableRow", () => {
  it("적요에 '입금완료'(공백 허용)면 수금", () => {
    expect(isPaidReceivableRow("", "입금완료")).toBe(true);
    expect(isPaidReceivableRow("", "5/30 입금 완료")).toBe(true);
  });

  it("상태 컬럼 수금/완료/입금이면 수금", () => {
    expect(isPaidReceivableRow("수금", "")).toBe(true);
    expect(isPaidReceivableRow("입금", "")).toBe(true);
    expect(isPaidReceivableRow("처리완료", "")).toBe(true);
  });

  it("상태에 미수/미입금이 섞이면 미수 우선", () => {
    expect(isPaidReceivableRow("미입금", "")).toBe(false);
    expect(isPaidReceivableRow("미수", "")).toBe(false);
  });

  it("빈 값이면 미수", () => {
    expect(isPaidReceivableRow("", "")).toBe(false);
  });
});
