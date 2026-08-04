import { describe, it, expect } from "vitest";
import { collectUnpaidMisuByCustomer } from "../collect";
import { runMatch } from "../algorithm";
import type { MisuRow, DepositRow } from "../types";

/**
 * 미수 시트 청구일자는 "2026.7.3"(점), 입금 시트 거래일시는 "2026-07-13 11:48:04"(하이픈)로
 * 표시 포맷이 다르다. 원본 문자열끼리 비교하면 '.'(0x2E) > '-'(0x2D) 때문에 점 포맷이
 * 항상 미래로 판정돼 합산 그룹에서 전부 빠진다.
 *
 * 실제 미발생 건 (2026-08-04): 이화여대 58,800(7.3) + 137,200(7.8) = 196,000 ↔
 * 입금 '이대데샤원' 196,000 (7-13)이 N:1로 안 잡힘.
 */

const misuDot: MisuRow[] = [
  {
    rowNumber: 100,
    date: "2026.7.3",
    customer: "이화여자대학교",
    amount: 58800,
    note: "",
  },
  {
    rowNumber: 101,
    date: "2026.7.8",
    customer: "이화여자대학교",
    amount: 137200,
    note: "",
  },
];

const deposit: DepositRow = {
  row: 10,
  date: "2026-07-13 11:48:04",
  amount: 196000,
  content: "이대데샤원",
  matchedFlag: "",
};

describe("날짜 표시 포맷이 섞여도 합산 대상에서 빠지지 않는다", () => {
  it("점 포맷 청구일자를 하이픈 포맷 입금일 기준으로 수집한다", () => {
    const got = collectUnpaidMisuByCustomer(
      misuDot,
      "이화여자대학교",
      "2026-07-13 11:48:04",
    );
    expect(got.map((r) => r.rowNumber)).toEqual([100, 101]);
  });

  it("입금일보다 나중 청구는 여전히 제외한다", () => {
    const later: MisuRow = { ...misuDot[0], rowNumber: 102, date: "2026.7.20" };
    const got = collectUnpaidMisuByCustomer(
      [...misuDot, later],
      "이화여자대학교",
      "2026-07-13 11:48:04",
    );
    expect(got.map((r) => r.rowNumber)).toEqual([100, 101]);
  });

  it("같은 날 청구는 포함한다 (경계)", () => {
    const sameDay: MisuRow = { ...misuDot[0], rowNumber: 103, date: "2026.7.13" };
    const got = collectUnpaidMisuByCustomer(
      [sameDay],
      "이화여자대학교",
      "2026-07-13 11:48:04",
    );
    expect(got.map((r) => r.rowNumber)).toEqual([103]);
  });

  it("N:1 합산이 성립한다 — 같은 거래처 입금이 여러 건이어도", () => {
    // 입금이 1건뿐이면 N:M 단계가 우연히 구제해 버그가 가려진다. 2건으로 그 구제를 막는다.
    const other: DepositRow = {
      row: 11,
      date: "2026-07-20 09:00:00",
      amount: 50000,
      content: "이대데샤원",
      matchedFlag: "",
    };
    const got = runMatch(misuDot, [deposit, other]);
    expect(got.matched).toEqual([
      {
        misuRows: [100, 101],
        depRows: [10],
        kind: "nToOne",
        depositDate: "2026-07-13 11:48:04",
        amount: 196000,
      },
    ]);
  });
});
