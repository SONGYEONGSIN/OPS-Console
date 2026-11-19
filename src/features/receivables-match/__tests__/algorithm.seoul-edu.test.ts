import { describe, it, expect } from "vitest";
import { runMatch } from "../algorithm";
import { normalizeName } from "../normalize";
import { isNameMatchStrong } from "../similarity";
import type { MisuRow, DepositRow } from "../types";

/**
 * 서울특별시 교육청 청구 ↔ 서울시교육청 입금.
 *
 * 2026-11-18 1,417,000원 입금이 이 표기 차이로 '불일치(확인 요청)' 에 올랐다.
 * 정규화하면 거래처는 "서울특별시교육청", 입금은 "서울시교육청" 이라 서로를
 * 포함하지 않아 강매칭이 서지 않는다.
 */

const misu = (customer: string, amount: number): MisuRow =>
  ({
    rowNumber: 2,
    date: "2026-11-09",
    customer,
    amount,
    note: "",
  }) as MisuRow;

const dep = (content: string, amount: number): DepositRow =>
  ({
    row: 10,
    date: "2026-11-18 16:39:24",
    content,
    amount,
    matchedFlag: "",
  }) as DepositRow;

describe("isNameMatchStrong — 서울시교육청 입금", () => {
  it("서울시교육청 입금은 서울특별시 교육청 미수와 강매칭된다", () => {
    expect(isNameMatchStrong("서울특별시 교육청", "서울시교육청")).toBe(true);
  });
});

describe("normalizeName — 기존 별칭과 부딪히지 않는다", () => {
  it("서울시립대학교는 그대로 서울시립대다", () => {
    expect(normalizeName("서울시립대학교")).toBe("서울시립대");
  });
});

describe("runMatch — 서울시교육청 입금", () => {
  it("서울특별시 교육청 1,417,000 청구와 서울시교육청 1,417,000 입금이 짝지어진다", () => {
    const result = runMatch(
      [misu("서울특별시 교육청", 1417000)],
      [dep("서울시교육청", 1417000)],
    );
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].misuRows).toEqual([2]);
    expect(result.matched[0].depRows).toEqual([10]);
    expect(result.mismatches).toHaveLength(0);
  });

  it("같은 금액의 경기도교육청 입금과는 짝지어지지 않는다", () => {
    const result = runMatch(
      [misu("서울특별시 교육청", 1417000)],
      [dep("경기도교육청", 1417000)],
    );
    expect(result.matched).toHaveLength(0);
  });
});
