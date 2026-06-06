import { describe, it, expect } from "vitest";
import type { ReceivablesSheet } from "../queries";
import { groupSchoolByOperator } from "../school-mail-grouping";

function mkSheet(
  headers: string[],
  rowsText: (string | number)[][],
): ReceivablesSheet {
  return {
    worksheetName: "Sheet1",
    metaRows: [],
    headers,
    rows: rowsText.map((r) => [...r]),
    rowsText: rowsText.map((r) => r.map((c) => String(c))),
    validColIdx: headers.map((_, i) => i),
    headerRowNumber: 1,
    rowCount: rowsText.length + 1,
    columnCount: headers.length,
    fetchedAt: "2026-05-30T00:00:00Z",
  };
}

const HEADERS = [
  "청구일자",
  "거래처명",
  "거래내역",
  "청구금액",
  "운영자",
  "학교담당자",
  "적요",
  "메일발송일자",
];
// NOW 기준 마일스톤: 2026-05-20→10일(SCHOOL_TARGET ✓), 2026-05-18→12일(✗)
const NOW = new Date("2026-05-30T12:00:00+09:00");

describe("groupSchoolByOperator", () => {
  it("마일스톤(경과 정확 일치)만 + (운영자,학교담당자) 그룹 + excelRow", () => {
    const sheet = mkSheet(HEADERS, [
      ["2026-05-20", "A학교", "원서", 1000000, "송영신", "a@x.com", "", ""], // 10일 ✓
      ["2026-05-18", "B학교", "원서", 500000, "송영신", "a@x.com", "", ""], // 12일 ✗ 마일스톤 아님
    ]);
    const { groups } = groupSchoolByOperator(sheet, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].sender.email).toBe("ys1114@jinhakapply.com");
    expect(groups[0].recipient.email).toBe("a@x.com");
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].excelRow).toBe(2);
  });

  it("같은 학교담당자면 1그룹 병합, 학교담당자 다르면 분리", () => {
    const sheet = mkSheet(HEADERS, [
      ["2026-05-20", "A학교", "원서", 1000000, "송영신", "a@x.com", "", ""],
      ["2026-05-20", "A학교 분교", "원서", 700000, "송영신", "a@x.com", "", ""], // 같은 담당자 → 병합
      ["2026-05-20", "B학교", "원서", 500000, "송영신", "b@x.com", "", ""], // 다른 담당자 → 분리
    ]);
    const { groups } = groupSchoolByOperator(sheet, NOW);
    expect(groups).toHaveLength(2);
    const a = groups.find((g) => g.recipient.email === "a@x.com")!;
    expect(a.items).toHaveLength(2);
    expect(a.totalAmount).toBe(1_700_000);
    expect(a.sender.email).toBe("ys1114@jinhakapply.com");
  });

  it("적요(처리완료) 채워진 행은 제외", () => {
    const sheet = mkSheet(HEADERS, [
      ["2026-05-20", "A학교", "원서", 1000000, "송영신", "a@x.com", "입금확인", ""],
    ]);
    const { groups } = groupSchoolByOperator(sheet, NOW);
    expect(groups).toHaveLength(0);
  });

  it("운영자명 매핑 실패 → excluded", () => {
    const sheet = mkSheet(HEADERS, [
      ["2026-05-20", "A학교", "원서", 1000000, "없는사람", "a@x.com", "", ""],
    ]);
    const { groups, excluded } = groupSchoolByOperator(sheet, NOW);
    expect(groups).toHaveLength(0);
    expect(excluded.some((e) => e.reason === "operator_email_not_mapped")).toBe(
      true,
    );
  });
});
