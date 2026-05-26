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
