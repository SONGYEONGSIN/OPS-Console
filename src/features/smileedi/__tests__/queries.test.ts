import { describe, it, expect } from "vitest";
import { parseSmileEdiRows } from "../queries";

const headers = [
  "작성일자",
  "품목",
  "공급가액",
  "세액",
  "거래처명",
  "담당부서-공급받는자",
  "담당자명-공급자",
  "승인번호",
  "이메일오류",
];

describe("parseSmileEdiRows", () => {
  it("헤더명으로 컬럼 매핑 + excelRow는 dataStartRowNumber부터", () => {
    const rows = [
      ["2026.04.01", "수수료", "100000", "10000", "서강대학교", "입학처", "", "A-1", ""],
      ["2026.04.02", "접수", "200000", "20000", "덕성여자대학교", "", "조가현", "A-2", "Y"],
    ];
    const { rows: parsed, emailErrorColIdx } = parseSmileEdiRows(headers, rows, 4);
    expect(emailErrorColIdx).toBe(8);
    expect(parsed[0]).toMatchObject({
      excelRow: 4,
      item: "수수료",
      companyName: "서강대학교",
      emailError: "",
    });
    expect(parsed[1]).toMatchObject({
      excelRow: 5,
      supplierManager: "조가현",
      emailError: "Y",
    });
  });

  it("누락 헤더는 빈 문자열로 안전 파싱", () => {
    const { rows, emailErrorColIdx } = parseSmileEdiRows(
      ["작성일자", "품목"],
      [["2026.04.01", "수수료"]],
      4,
    );
    expect(emailErrorColIdx).toBe(-1);
    expect(rows[0]).toMatchObject({ item: "수수료", companyName: "", emailError: "" });
  });
});
