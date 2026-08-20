import { describe, it, expect } from "vitest";
import {
  nextDaySeq,
  buildLedgerRows,
  findLedgerInsertRow,
  LEDGER_COL_COUNT,
} from "../ledger-write";
import { LEDGER_HEADERS } from "../ledger-parse";

/**
 * 확정한 등기를 대장 엑셀에 쓴다 — 3단계.
 *
 * 지금까지는 확정해도 DB와 전도금에만 들어가고 **등기대장은 손으로** 적었다.
 *
 * 대장은 날짜순이고 순번은 **그날 몇 번째**를 센다(엑셀 실물이 그렇다 —
 * 8/14 은 1~7, 8/18 은 1~3). 이어 붙일 때 그 규칙을 지켜야 한다.
 */

// 실제 대장 모양을 줄여 옮긴 것. 46252 = 2026-08-18, 46253 = 2026-08-19
const sheet = [
  [...LEDGER_HEADERS],
  [1, 46252, "우석대학교", "강정화", "김지현", "박수정", "11263-1102-7080", ""],
  [2, 46252, "한림성심대학교", "김한솔", "김승현", "박수정", "11263-1102-7081", ""],
  [1, 46253, "두원공과대학교", "고희관", "김슬기", "박수정", "11263-1002-5431", ""],
];

describe("nextDaySeq", () => {
  it("그날 마지막 순번 다음", () => {
    expect(nextDaySeq(sheet, 46252)).toBe(3);
  });

  it("그날이 처음이면 1", () => {
    expect(nextDaySeq(sheet, 46254)).toBe(1);
  });

  it("다른 날 순번에 이어 붙이지 않는다 — 날짜별로 다시 1부터다", () => {
    // 46253 은 1건뿐이라 다음은 2 (전체 4번째가 아니다)
    expect(nextDaySeq(sheet, 46253)).toBe(2);
  });
});

describe("findLedgerInsertRow", () => {
  it("가장 최근 날짜면 맨 아래", () => {
    expect(findLedgerInsertRow(sheet, 46254)).toEqual({
      row: 5,
      shiftDown: false,
    });
  });

  it("중간 날짜면 그 자리에 끼워 넣는다", () => {
    expect(findLedgerInsertRow(sheet, 46252)).toEqual({
      row: 4,
      shiftDown: true,
    });
  });
});

describe("buildLedgerRows", () => {
  const rows = [
    {
      trackingNo: "11263-1102-7082",
      recipientOrg: "국립창원대학교",
      recipientName: "김좌경",
      assignee: "기자의",
    },
    {
      trackingNo: "11263-1102-7083",
      recipientOrg: "재능대학교",
      recipientName: "이도현",
      assignee: "박시현",
    },
  ];

  it("엑셀 열 순서 그대로 만든다", () => {
    const out = buildLedgerRows(rows, {
      dateSerial: 46252,
      startSeq: 3,
      confirmedBy: "박수정",
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toHaveLength(LEDGER_COL_COUNT);
    expect(out[0][0]).toBe(3); // 순번
    expect(out[0][1]).toBe(46252); // 발송일 — 일련번호
    expect(out[0][2]).toBe("국립창원대학교");
    expect(out[0][3]).toBe("김좌경");
    expect(out[0][4]).toBe("기자의");
    expect(out[0][5]).toBe("박수정"); // 확인 = 올린 사람
    expect(out[0][6]).toBe("11263-1102-7082");
  });

  it("순번이 이어진다 — 한 영수증에 여러 건이 찍힌다", () => {
    const out = buildLedgerRows(rows, {
      dateSerial: 46252,
      startSeq: 3,
      confirmedBy: "박수정",
    });
    expect(out[1][0]).toBe(4);
  });

  it("담당자가 비어도 행은 만든다 — 대장에 빈 칸으로 남는 게 사실이다", () => {
    const out = buildLedgerRows([{ ...rows[0], assignee: null }], {
      dateSerial: 46252,
      startSeq: 1,
      confirmedBy: "박수정",
    });
    expect(out[0][4]).toBe("");
  });
});
