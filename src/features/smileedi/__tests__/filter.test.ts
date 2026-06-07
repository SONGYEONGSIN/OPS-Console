import { describe, it, expect } from "vitest";
import { filterSendable } from "../filter";
import type { SmileEdiRow } from "../types";

const KEYWORDS = ["수수료", "접수", "강사", "대입", "인터넷"];

function row(over: Partial<SmileEdiRow>): SmileEdiRow {
  return {
    excelRow: 4,
    writeDate: "20260401",
    item: "수수료",
    supplyAmount: "100000",
    taxAmount: "10000",
    companyName: "서강대학교",
    receiverDept: "입학처",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    supplierManager: "",
    approvalNumber: "20260401-1",
    emailError: "",
    ...over,
  };
}

describe("filterSendable — 2조건 (이메일오류≠Y AND 품목키워드)", () => {
  it("이메일오류='Y'면 제외 (키워드 매치해도)", () => {
    expect(filterSendable([row({ emailError: "Y" })], KEYWORDS)).toHaveLength(0);
  });

  it("이메일오류 소문자 'y'도 제외 (대소문자 무시)", () => {
    expect(filterSendable([row({ emailError: "y" })], KEYWORDS)).toHaveLength(0);
  });

  it("품목키워드 미매치면 제외", () => {
    expect(
      filterSendable([row({ item: "기타용역", companyName: "ABC", receiverDept: "" })], KEYWORDS),
    ).toHaveLength(0);
  });

  it("이메일오류≠Y + 품목키워드 매치 → 통과", () => {
    expect(filterSendable([row({ emailError: "", item: "접수수수료" })], KEYWORDS)).toHaveLength(1);
  });

  it("키워드가 품목이 아닌 다른 텍스트 필드에 있어도 통과 (any 컬럼)", () => {
    expect(
      filterSendable([row({ item: "용역", receiverDept: "인터넷접수팀" })], KEYWORDS),
    ).toHaveLength(1);
  });
});
