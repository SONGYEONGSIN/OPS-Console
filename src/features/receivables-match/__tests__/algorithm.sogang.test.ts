import { describe, it, expect } from "vitest";
import { runMatch } from "../algorithm";
import { isNameMatchStrong } from "../similarity";
import type { MisuRow, DepositRow } from "../types";

/**
 * 서강대학교 청구 ↔ 서강공대원(서강대 공학대학원, 은행 절단 표기) 입금.
 *
 * 2026-11-10 서강대 120,000원 확인 요청이 이 표기 차이로 보류됐다. 과거에도
 * 같은 이름의 입금이 미매칭으로 남았고, 한 건은 한양대학교와 잘못 짝지어졌다.
 * "서강공대원1" 과 "서강대" 는 서로를 포함하지 않아 강매칭이 서지 않는다.
 */

const misu = (customer: string, amount: number): MisuRow =>
  ({
    rowNumber: 2,
    date: "2026-11-02",
    customer,
    amount,
    note: "",
  }) as MisuRow;

const dep = (content: string, amount: number): DepositRow =>
  ({
    row: 10,
    date: "2026-11-10",
    content,
    amount,
    matchedFlag: "",
  }) as DepositRow;

describe("isNameMatchStrong — 서강공대원 입금", () => {
  it.each(["서강공대원1", "서강공대원1차", "서강공대원2차"])(
    "%s 입금은 서강대학교 미수와 강매칭된다",
    (content) => {
      expect(isNameMatchStrong("서강대학교", content)).toBe(true);
    },
  );
});

describe("runMatch — 서강공대원 입금", () => {
  it("서강대학교 120,000 청구와 서강공대원1 120,000 입금이 짝지어진다", () => {
    const result = runMatch(
      [misu("서강대학교", 120000)],
      [dep("서강공대원1", 120000)],
    );
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].misuRows).toEqual([2]);
    expect(result.matched[0].depRows).toEqual([10]);
    expect(result.mismatches).toHaveLength(0);
  });

  it("다른 대학(한양대학교) 같은 금액 청구와는 짝지어지지도, 확인 요청에 오르지도 않는다", () => {
    const result = runMatch(
      [misu("한양대학교", 120000)],
      [dep("서강공대원2차", 120000)],
    );
    expect(result.matched).toHaveLength(0);
    expect(result.mismatches).toHaveLength(0);
  });
});
