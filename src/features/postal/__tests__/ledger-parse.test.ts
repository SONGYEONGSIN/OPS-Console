import { describe, it, expect } from "vitest";
import {
  excelSerialToIso,
  isoToExcelSerial,
  expectedSheetName,
  parseLedgerRows,
  LEDGER_HEADERS,
} from "../ledger-parse";

/**
 * 등기관리대장(`2026년도 우편물 발송.xlsx`) 읽기.
 *
 * 화면의 주인공은 **대장**이고 영수증은 증빙이다. 지금까지는 반대로 영수증 목록이
 * 표를 차지하고 있었다(2026-08-20 지적).
 */
describe("excelSerialToIso", () => {
  it("엑셀 일련번호를 날짜로 되돌린다", () => {
    // 실제 대장 첫 행이 46113이고 2026-04-01 이다.
    expect(excelSerialToIso(46113)).toBe("2026-04-01");
  });

  it("왕복해도 같은 값이다", () => {
    expect(isoToExcelSerial(excelSerialToIso(46113))).toBe(46113);
    expect(excelSerialToIso(isoToExcelSerial("2026-08-18"))).toBe("2026-08-18");
  });

  it("1900 윤년 버그 구간 뒤에서 맞는다 — 하루 밀리면 대장이 통째로 어긋난다", () => {
    // 1900-03-01 = 61 (엑셀은 존재하지 않는 1900-02-29를 60으로 센다)
    expect(excelSerialToIso(61)).toBe("1900-03-01");
  });

  it("이미 문자열 날짜면 그대로 둔다 — 셀 서식이 섞여 있다", () => {
    expect(excelSerialToIso("2026-08-18")).toBe("2026-08-18");
  });
});

describe("expectedSheetName", () => {
  it("연도가 시트 이름에 박혀 있다", () => {
    expect(expectedSheetName(2026)).toBe("2026년도 우편물발송(04월~)");
  });
});

describe("parseLedgerRows", () => {
  const values = [
    [...LEDGER_HEADERS],
    [1, 46113, "아주대학교", "이나경", "정윤나", "박수정", "11263-1001-4952", ""],
    [2, 46113, "경인여자대학교", "김병국", "김지현", "박수정", "11263-1001-4953", "재발송"],
    ["", "", "", "", "", "", "", ""],
  ];

  it("헤더를 빼고 행으로 만든다", () => {
    const rows = parseLedgerRows(values);
    expect(rows).toHaveLength(2);
    expect(rows[0].recipientOrg).toBe("아주대학교");
    expect(rows[0].trackingNo).toBe("11263-1001-4952");
    expect(rows[1].note).toBe("재발송");
  });

  it("발송일을 날짜로 되돌린다", () => {
    expect(parseLedgerRows(values)[0].sentOn).toBe("2026-04-01");
  });

  it("빈 행은 버린다 — 엑셀 끝의 빈 줄이 유령 행이 된다", () => {
    expect(parseLedgerRows(values).every((r) => r.trackingNo)).toBe(true);
  });

  it("헤더가 다르면 던진다 — 열 순서가 바뀌면 엉뚱한 칸을 읽는다", () => {
    const wrong = [["순번", "발송일", "수신자", "수신처"], [1, 46113, "a", "b"]];
    expect(() => parseLedgerRows(wrong)).toThrow();
  });

  it("등기번호가 없는 행도 남긴다 — 사람이 채우다 만 것도 대장의 사실이다", () => {
    const partial = [
      [...LEDGER_HEADERS],
      [3, 46113, "한신대학교", "류수윤", "윤지혜", "박수정", "", ""],
    ];
    const rows = parseLedgerRows(partial);
    expect(rows).toHaveLength(1);
    expect(rows[0].trackingNo).toBe("");
  });
});
