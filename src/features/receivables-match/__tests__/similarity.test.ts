import { describe, it, expect } from "vitest";
import { similarity, isNameMatchStrong } from "../similarity";
import fixture from "./fixtures/gas-cases.json";

type IsMatchCase = { name: string; a: string; b: string; expected: boolean };
type SimilarityCase = {
  name: string;
  a: string;
  b: string;
  expected?: number;
  expectedRange?: [number, number];
};

describe("isNameMatchStrong — GAS isNameMatchStrong_ 1:1", () => {
  for (const c of fixture.isNameMatchStrong as IsMatchCase[]) {
    it(c.name, () => {
      expect(isNameMatchStrong(c.a, c.b)).toBe(c.expected);
    });
  }
});

describe("isNameMatchStrong — OPS-Console alias 확장 (GAS 원본 외)", () => {
  it("한양MBA 입금 ↔ 한양대학교 미수 매칭 (숙명MBA와 동일 패턴)", () => {
    expect(isNameMatchStrong("한양대학교", "한양MBA")).toBe(true);
  });
});

describe("isNameMatchStrong — extraAliases (런타임 학습)", () => {
  it("alias 없으면 서강대학교 ↔ 서강국제대학원 불일치", () => {
    expect(isNameMatchStrong("서강대학교", "서강국제대학원")).toBe(false);
  });
  it("학습된 alias로 서강국제대학원 입금이 서강대 미수와 강매칭", () => {
    expect(
      isNameMatchStrong("서강대학교", "서강국제대학원", {
        서강국제대학원: "서강대",
      }),
    ).toBe(true);
  });
});

describe("similarity — GAS similarity_ (Levenshtein 기반)", () => {
  for (const c of fixture.similarity as SimilarityCase[]) {
    it(c.name, () => {
      const got = similarity(c.a, c.b);
      if (c.expected !== undefined) {
        expect(got).toBe(c.expected);
      } else if (c.expectedRange) {
        expect(got).toBeGreaterThanOrEqual(c.expectedRange[0]);
        expect(got).toBeLessThanOrEqual(c.expectedRange[1]);
      }
    });
  }
});
