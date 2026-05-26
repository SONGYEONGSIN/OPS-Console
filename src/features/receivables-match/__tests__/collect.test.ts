import { describe, it, expect } from "vitest";
import {
  collectUnpaidMisuByCustomer,
  collectUnpaidDepositsByCustomer,
} from "../collect";
import type { MisuRow, DepositRow } from "../types";
import fixture from "./fixtures/gas-cases.json";

type CollectCase = {
  name: string;
  scenario: "collectUnpaidMisuByCustomer" | "collectUnpaidDepositsByCustomer";
  rows?: Array<{
    rowNumber: number;
    date: string;
    customer: string;
    amount: number;
    note: string;
  }>;
  deposits?: Array<{
    row: number;
    date: string;
    amount: number;
    content: string;
    matchedFlag: string;
  }>;
  custName: string;
  limitDate?: string;
  billDate?: string;
  matchedDepRows?: number[];
  expectedRowNumbers?: number[];
  expectedRows?: number[];
};

const cases = fixture.collect as CollectCase[];

describe("collectUnpaidMisuByCustomer / collectUnpaidDepositsByCustomer — GAS 1:1", () => {
  for (const c of cases) {
    it(c.name, () => {
      if (c.scenario === "collectUnpaidMisuByCustomer") {
        const misuRows: MisuRow[] = (c.rows ?? []).map((r) => ({
          rowNumber: r.rowNumber,
          date: r.date,
          customer: r.customer,
          amount: r.amount,
          note: r.note,
        }));
        const got = collectUnpaidMisuByCustomer(
          misuRows,
          c.custName,
          c.limitDate!,
        );
        expect(got.map((r) => r.rowNumber)).toEqual(c.expectedRowNumbers);
      } else {
        const depRows: DepositRow[] = (c.deposits ?? []).map((d) => ({
          row: d.row,
          date: d.date,
          amount: d.amount,
          content: d.content,
          matchedFlag: d.matchedFlag,
        }));
        const matchedSet = new Set<number>(c.matchedDepRows ?? []);
        const got = collectUnpaidDepositsByCustomer(
          depRows,
          c.custName,
          c.billDate!,
          matchedSet,
        );
        expect(got.map((r) => r.row)).toEqual(c.expectedRows);
      }
    });
  }
});
