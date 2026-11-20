import { describe, it, expect } from "vitest";
import { runMatch } from "../algorithm";
import { normalizeName } from "../normalize";
import { isNameMatchStrong } from "../similarity";
import type { MisuRow, DepositRow } from "../types";

/**
 * 충남대학교 의과대학교 보건대학원 청구 ↔ 충남대보건원 입금.
 *
 * 2026-11-19 188,000원 입금이 이 표기 차이로 '불일치(확인 요청)' 에 올랐다.
 * 정규화하면 거래처는 "충남대의과대보건대원", 입금은 "충남대보건원" 이라 서로를
 * 포함하지 않아 강매칭이 서지 않는다.
 */

const misu = (customer: string, amount: number): MisuRow =>
  ({
    rowNumber: 2,
    date: "2026-11-16",
    customer,
    amount,
    note: "",
  }) as MisuRow;

const dep = (content: string, amount: number): DepositRow =>
  ({
    row: 10,
    date: "2026-11-19 11:50:57",
    content,
    amount,
    matchedFlag: "",
  }) as DepositRow;

describe("isNameMatchStrong — 충남대보건원 입금", () => {
  it("충남대보건원 입금은 충남대학교 의과대학교 보건대학원 미수와 강매칭된다", () => {
    expect(
      isNameMatchStrong("충남대학교 의과대학교 보건대학원", "충남대보건원"),
    ).toBe(true);
  });
});

describe("normalizeName — 기존 별칭과 부딪히지 않는다", () => {
  it("충남대학교는 그대로 충남대다", () => {
    expect(normalizeName("충남대학교")).toBe("충남대");
  });

  it("충대는 그대로 충남대다", () => {
    expect(normalizeName("충대")).toBe("충남대");
  });
});

describe("runMatch — 충남대보건원 입금", () => {
  it("충남대학교 의과대학교 보건대학원 188,000 청구와 충남대보건원 188,000 입금이 짝지어진다", () => {
    const result = runMatch(
      [misu("충남대학교 의과대학교 보건대학원", 188000)],
      [dep("충남대보건원", 188000)],
    );
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].misuRows).toEqual([2]);
    expect(result.matched[0].depRows).toEqual([10]);
    expect(result.mismatches).toHaveLength(0);
  });

  it("같은 금액의 충남대학교 대학원 청구와는 짝지어지지 않는다", () => {
    const result = runMatch(
      [misu("충남대학교 대학원", 188000)],
      [dep("충남대보건원", 188000)],
    );
    expect(result.matched).toHaveLength(0);
  });
});
