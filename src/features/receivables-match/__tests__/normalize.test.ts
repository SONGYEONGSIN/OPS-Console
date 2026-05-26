import { describe, it, expect } from "vitest";
import { normalizeName } from "../normalize";
import fixture from "./fixtures/gas-cases.json";

type NormalizeCase = { name: string; input: string; expected: string };

const cases = fixture.normalize as NormalizeCase[];

describe("normalizeName — GAS normalizeName_ 1:1 포팅", () => {
  for (const c of cases) {
    it(c.name, () => {
      expect(normalizeName(c.input)).toBe(c.expected);
    });
  }
});
