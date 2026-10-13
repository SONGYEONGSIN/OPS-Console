import { describe, it, expect } from "vitest";
import type { ReceivablesSheet } from "@/features/receivables/queries";
import { listUnpaidSchools } from "../unpaid-schools";
import { parseDepositSheet } from "../deposit-queries";

const HEADERS = [
  "청구일자",
  "거래처명",
  "청구금액",
  "입금여부",
  "적 요(피드백 내용)",
];

/** [청구일자, 거래처명, 금액, 입금여부, 적요] 행들 → 시트 (헤더는 1행, 데이터는 2행부터) */
function sheetOf(rows: Array<[string, string, number, string, string]>) {
  const sheet: ReceivablesSheet = {
    worksheetName: "미수",
    metaRows: [],
    headers: HEADERS,
    rows: rows.map((r) => [...r]),
    rowsText: rows.map((r) => r.map((c) => String(c))),
    validColIdx: [0, 1, 2, 3, 4],
    headerRowNumber: 1,
    rowCount: rows.length,
    columnCount: HEADERS.length,
    fetchedAt: "2026-10-13T00:00:00.000Z",
  };
  return sheet;
}

describe("listUnpaidSchools", () => {
  it("적요에 입금완료가 있는 행은 뺀다", () => {
    const sheet = sheetOf([
      ["2026-04-10", "가천대", 100000, "", "입금완료"],
      ["2026-04-11", "나대학", 100000, "", ""],
    ]);
    expect(listUnpaidSchools(sheet, new Set())).toEqual(["나대학"]);
  });

  it("상태 열이 수금이면 뺀다 — isPaidReceivableRow 경로", () => {
    const sheet = sheetOf([
      ["2026-04-10", "가천대", 100000, "수금", ""],
      ["2026-04-11", "나대학", 100000, "미수", ""],
    ]);
    expect(listUnpaidSchools(sheet, new Set())).toEqual(["나대학"]);
  });

  it("같은 학교의 여러 행은 한 번만 나온다", () => {
    const sheet = sheetOf([
      ["2026-04-10", "가천대", 100000, "", ""],
      ["2026-05-10", "가천대", 50000, "", ""],
    ]);
    expect(listUnpaidSchools(sheet, new Set())).toEqual(["가천대"]);
  });

  it("가장 이른 청구일이 위 — 학교별 최초 청구일 오름차순", () => {
    const sheet = sheetOf([
      ["2026-06-01", "다대학", 100000, "", ""],
      ["2026-04-01", "가천대", 100000, "", ""],
      ["2026-03-01", "다대학", 100000, "", ""],
      ["2026.5.3", "나대학", 100000, "", ""],
    ]);
    expect(listUnpaidSchools(sheet, new Set())).toEqual([
      "다대학",
      "가천대",
      "나대학",
    ]);
  });

  it("청구일이 같으면 가나다순", () => {
    const sheet = sheetOf([
      ["2026-04-01", "하대학", 100000, "", ""],
      ["2026-04-01", "가대학", 100000, "", ""],
      ["2026-04-01", "나대학", 100000, "", ""],
    ]);
    expect(listUnpaidSchools(sheet, new Set())).toEqual([
      "가대학",
      "나대학",
      "하대학",
    ]);
  });

  it("방금 매칭된 행번호는 미수에서 뺀다 (학교의 다른 행이 남으면 남는다)", () => {
    const sheet = sheetOf([
      ["2026-04-10", "가천대", 100000, "", ""], // 행 2
      ["2026-04-11", "나대학", 100000, "", ""], // 행 3
      ["2026-05-11", "나대학", 100000, "", ""], // 행 4
    ]);
    expect(listUnpaidSchools(sheet, new Set([2, 3]))).toEqual(["나대학"]);
  });

  it("거래처명이 빈 행 · 금액 0/빈 행 · 합계 행은 뺀다", () => {
    const sheet = sheetOf([
      ["2026-04-10", "", 100000, "", ""],
      ["2026-04-10", "영원대", 0, "", ""],
      ["2026-04-10", "소계", 100000, "", ""],
      ["2026-04-10", "가천대", 100000, "", ""],
    ]);
    expect(listUnpaidSchools(sheet, new Set())).toEqual(["가천대"]);
  });

  it("거래처명은 정규화하지 않고 그대로 낸다 (앞뒤 공백만 정리)", () => {
    const sheet = sheetOf([["2026-04-10", " 가천대학교(서울) ", 1, "", ""]]);
    expect(listUnpaidSchools(sheet, new Set())).toEqual(["가천대학교(서울)"]);
  });
});

describe("입금내역 시트 V열 — parseDepositSheet 영향 없음", () => {
  it("V열에 머리글·학교명이 있어도 입금 행 파싱(A~K)은 그대로다", () => {
    const header = [
      "거래일시",
      "출금금액",
      "입금금액",
      "거래내용",
      "미결제표시",
    ];
    const pad = Array.from({ length: 16 }, () => "");
    const values: unknown[][] = [
      [...header, ...pad, "미수 학교 (2곳)"],
      ["2026-04-15 10:00:00", 0, 100000, "가천대", "", ...pad, "가대학"],
      ["", "", "", "", "", ...pad, "나대학"],
    ];
    const rows = parseDepositSheet({ values });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 100000, content: "가천대" });
  });
});
