import { describe, it, expect } from "vitest";
import { findInsertRow, balanceFormula, PETTY_HEADERS } from "../append";

/**
 * 사용내역을 어느 줄에 넣을 것인가.
 *
 * 우편물은 날짜순으로 쌓이지만, 사무용품을 뒤늦게 넣는 일이 있다(2026-08-20).
 * 날짜가 뒤섞이면 **잔액 수식이 가리키는 순서와 실제 시간 순서가 어긋난다** —
 * 잔액은 바로 윗줄에서 빼는 구조라 줄 순서가 곧 계산 순서다.
 *
 * 행 번호는 1부터 센다(엑셀과 같게). 1행은 헤더다.
 */

// 실제 대장 모양: 헤더 + 충전 + 사용… (충전 행은 날짜가 없다)
const sheet = [
  [...PETTY_HEADERS],
  ["전도금청구", 500000, 500000, "", "", "", "", ""],
  ["", "", 496080, 46108, "우편물", 1, 3920, ""],
  ["", "", 151020, 46252, "우편물", 3, 13290, ""],
  ["전도금청구", 348980, 500000, "", "", "", "", ""],
  ["", "", 491660, 46253, "우편물", 2, 8340, ""],
];

describe("findInsertRow", () => {
  it("가장 최근 날짜면 맨 아래에 붙인다", () => {
    // 46254 = 2026-08-20, 마지막 행(46253)보다 뒤
    expect(findInsertRow(sheet, 46254)).toEqual({ row: 7, shiftDown: false });
  });

  it("중간 날짜면 그 자리에 끼워 넣는다 — 아래를 밀어낸다", () => {
    // 46200 은 46108 뒤, 46252 앞
    expect(findInsertRow(sheet, 46200)).toEqual({ row: 4, shiftDown: true });
  });

  it("같은 날짜면 그날 마지막 뒤에 붙인다 — 먼저 적은 것이 위다", () => {
    expect(findInsertRow(sheet, 46252)).toEqual({ row: 5, shiftDown: true });
  });

  it("충전 행은 건너뛰지 않는다 — 잔액이 리셋되는 경계라 순서를 지켜야 한다", () => {
    // 46253 은 충전(5행) 뒤의 6행과 같은 날 → 그 뒤(7행)
    expect(findInsertRow(sheet, 46253)).toEqual({ row: 7, shiftDown: false });
  });

  it("가장 이른 날짜면 첫 사용 행 앞에 넣는다", () => {
    expect(findInsertRow(sheet, 46000)).toEqual({ row: 3, shiftDown: true });
  });
});

describe("balanceFormula", () => {
  it("바로 윗줄 잔액에서 이번 금액을 뺀다", () => {
    expect(balanceFormula(74)).toBe("=$C73-$G74");
  });

  it("헤더 바로 아래에는 만들지 않는다 — 뺄 윗줄이 없다", () => {
    expect(() => balanceFormula(2)).toThrow();
  });
});
