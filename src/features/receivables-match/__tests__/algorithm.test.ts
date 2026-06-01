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
