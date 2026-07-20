import { describe, it, expect } from "vitest";
import { runMatch } from "../algorithm";
import type { MisuRow, DepositRow } from "../types";
import fixture from "./fixtures/gas-cases.json";

type AlgorithmCase = {
  name: string;
  misu: Array<{
    rowNumber: number;
    date: string;
    customer: string;
    amount: number;
    note: string;
  }>;
  deposits: Array<{
    row: number;
    date: string;
    amount: number;
    content: string;
    matchedFlag: string;
  }>;
  expected: {
    matched?: Array<{ misuRows: number[]; depRows: number[]; kind: string }>;
    mismatches?: Array<{ misuRow: number; depRow: number; amount: number }>;
    unmatchedMisu?: number[];
    unmatchedDep?: number[];
    matchedCount?: number;
    unmatchedMisuCount?: number;
    unmatchedDepCount?: number;
  };
};

const cases = fixture.algorithm as AlgorithmCase[];

describe("runMatch — 3단계 디스패처 (단건 → N:1 → N:M) + mismatch detect", () => {
  for (const c of cases) {
    it(c.name, () => {
      const misu: MisuRow[] = c.misu;
      const dep: DepositRow[] = c.deposits;
      const result = runMatch(misu, dep);

      if (c.expected.matched) {
        expect(result.matched.length).toBe(c.expected.matched.length);
        c.expected.matched.forEach((m, i) => {
          expect(result.matched[i].misuRows.sort()).toEqual(m.misuRows.sort());
          expect(result.matched[i].depRows.sort()).toEqual(m.depRows.sort());
          expect(result.matched[i].kind).toBe(m.kind);
        });
      }
      if (c.expected.mismatches) {
        expect(result.mismatches.length).toBe(c.expected.mismatches.length);
        c.expected.mismatches.forEach((mm, i) => {
          expect(result.mismatches[i].misuRow).toBe(mm.misuRow);
          expect(result.mismatches[i].depRow).toBe(mm.depRow);
          expect(result.mismatches[i].amount).toBe(mm.amount);
        });
      }
      if (c.expected.unmatchedMisu !== undefined) {
        expect(result.unmatchedMisu.sort()).toEqual(
          c.expected.unmatchedMisu.sort(),
        );
      }
      if (c.expected.unmatchedDep !== undefined) {
        expect(result.unmatchedDep.sort()).toEqual(
          c.expected.unmatchedDep.sort(),
        );
      }
      if (c.expected.matchedCount !== undefined) {
        expect(result.matched.length).toBe(c.expected.matchedCount);
      }
      if (c.expected.unmatchedMisuCount !== undefined) {
        expect(result.unmatchedMisu.length).toBe(
          c.expected.unmatchedMisuCount,
        );
      }
      if (c.expected.unmatchedDepCount !== undefined) {
        expect(result.unmatchedDep.length).toBe(c.expected.unmatchedDepCount);
      }
    });
  }
});

describe("runMatch — extraAliases (학습된 alias로 mismatch → match)", () => {
  const misu: MisuRow[] = [
    {
      rowNumber: 27,
      date: "2026-05-01",
      customer: "서강대학교",
      amount: 84000,
      note: "",
    },
  ];
  const deposits: DepositRow[] = [
    {
      row: 1769,
      date: "2026-05-03",
      amount: 84000,
      content: "서강국제대학원",
      matchedFlag: "",
    },
  ];

  it("alias 없으면 mismatch (금액 동일·이름 불일치)", () => {
    const r = runMatch(misu, deposits);
    expect(r.matched.length).toBe(0);
    expect(r.mismatches.length).toBe(1);
    expect(r.mismatches[0].misuRow).toBe(27);
    expect(r.mismatches[0].depRow).toBe(1769);
  });

  it("학습된 alias로 자동 매칭 (mismatch 0)", () => {
    const r = runMatch(misu, deposits, { 서강국제대학원: "서강대" });
    expect(r.matched.length).toBe(1);
    expect(r.matched[0].misuRows).toEqual([27]);
    expect(r.matched[0].depRows).toEqual([1769]);
    expect(r.mismatches.length).toBe(0);
  });
});

describe("runMatch — mismatch 유사도 게이트 (명백히 다른 거래처 제외)", () => {
  // 금액은 같지만 거래처명이 명백히 다른 건(유사도 < 0.4)은 확인 요청에서 제외.
  it("명지대학교 ↔ 충북대국제교류(유사도 0.29) — mismatch 제외", () => {
    const r = runMatch(
      [{ rowNumber: 30, date: "2026-05-29", customer: "명지대학교", amount: 260000, note: "" }],
      [{ row: 1800, date: "2026-06-11", amount: 260000, content: "충북대국제교류", matchedFlag: "" }],
    );
    expect(r.matched.length).toBe(0);
    expect(r.mismatches.length).toBe(0);
  });

  it("서강대학교 ↔ 서강국제대학원(유사도 0.57) — mismatch 유지(확인 요청)", () => {
    const r = runMatch(
      [{ rowNumber: 31, date: "2026-05-01", customer: "서강대학교", amount: 84000, note: "" }],
      [{ row: 1801, date: "2026-05-03", amount: 84000, content: "서강국제대학원", matchedFlag: "" }],
    );
    expect(r.mismatches.length).toBe(1);
  });
});

describe("runMatch — 적요 미처리 판정은 '입금완료'만 제외 (자유메모는 매칭 대상)", () => {
  const deposit: DepositRow[] = [
    { row: 100, date: "2026-07-15", amount: 110000, content: "한양대창업대학", matchedFlag: "" },
  ];

  it("자유메모가 있는 미수도 N:1 합산에 포함 (한양대 70,000+40,000=110,000)", () => {
    const misu: MisuRow[] = [
      { rowNumber: 6, date: "2026-05-28", customer: "한양대학교", amount: 70000, note: "202606180003 거래 건의 수수료와 같이 입금함" },
      { rowNumber: 18, date: "2026-06-18", customer: "한양대학교", amount: 40000, note: "" },
    ];
    const r = runMatch(misu, deposit);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0].misuRows.slice().sort((a, b) => a - b)).toEqual([6, 18]);
    expect(r.matched[0].kind).toBe("nToOne");
  });

  it("'입금완료' 적요는 여전히 제외 (합산 불가 → 미매칭)", () => {
    const misu: MisuRow[] = [
      { rowNumber: 5, date: "2026-05-28", customer: "한양대학교", amount: 70000, note: "입금완료" },
      { rowNumber: 18, date: "2026-06-18", customer: "한양대학교", amount: 40000, note: "" },
    ];
    const r = runMatch(misu, deposit);
    expect(r.matched).toHaveLength(0);
    expect(r.unmatchedDep).toContain(100);
  });
});
