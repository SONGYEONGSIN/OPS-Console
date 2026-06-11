import { describe, it, expect } from "vitest";
import { toMisuRows } from "../misu-rows";
import type { ReceivablesSheet } from "@/features/receivables/queries";

const sheet: ReceivablesSheet = {
  worksheetName: "미수",
  metaRows: [],
  headers: ["청구일자", "거래처명", "운영자", "청구금액", "경과일수", "적요"],
  rows: [["2026-05-01", "서강대학교", "김슬기", 84000, 30, ""]],
  rowsText: [["2026-05-01", "서강대학교", "김슬기", "84000", "30", ""]],
  validColIdx: [0, 1, 2, 3, 4, 5],
  headerRowNumber: 1,
  rowCount: 1,
  columnCount: 6,
  fetchedAt: new Date().toISOString(),
} as ReceivablesSheet;

describe("toMisuRows", () => {
  it("시트 → MisuRow (rowNumber = headerRowNumber+1+i)", () => {
    const rows = toMisuRows(sheet);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      date: "2026-05-01",
      customer: "서강대학교",
      amount: 84000,
    });
  });

  it("필수 컬럼(청구일자/거래처/금액) 없으면 빈 배열", () => {
    const bad = { ...sheet, headers: ["x", "y"] } as ReceivablesSheet;
    expect(toMisuRows(bad)).toEqual([]);
  });

  // 실제 운영 시트 헤더는 "적 요(피드백 내용)" (적·요 사이 공백 + 부가문구).
  // noteCol 정규식이 이를 못 잡으면 note=""가 되어 이미 입금완료된 행도 미처리로 오인된다.
  it('실제 헤더 "적 요(피드백 내용)"에서 적요(입금완료)를 읽는다', () => {
    const real: ReceivablesSheet = {
      ...sheet,
      headers: [
        "청구일자",
        "매출구분",
        "거래처명",
        "거래내역",
        "운영자",
        "청구금액",
        "학교담당자",
        "메일발송일자",
        "입금예정일",
        "적 요(피드백 내용)",
      ],
      rows: [
        [
          "2026-05-07",
          "외상매출금(전형료)",
          "한양대학교",
          "202605070002",
          "한효진",
          90000,
          "sophia@hanyang.ac.kr",
          "",
          "2026-06-05",
          "입금완료",
        ],
      ],
      rowsText: [
        [
          "2026-05-07",
          "외상매출금(전형료)",
          "한양대학교",
          "202605070002",
          "한효진",
          "90,000",
          "sophia@hanyang.ac.kr",
          "",
          "2026-06-05",
          "입금완료",
        ],
      ],
      validColIdx: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      columnCount: 10,
    } as ReceivablesSheet;

    const rows = toMisuRows(real);
    expect(rows).toHaveLength(1);
    expect(rows[0].customer).toBe("한양대학교");
    expect(rows[0].amount).toBe(90000);
    expect(rows[0].note).toBe("입금완료");
  });
});
