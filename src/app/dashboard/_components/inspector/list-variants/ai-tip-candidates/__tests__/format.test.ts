import { describe, it, expect } from "vitest";
import { repoLanguageCell } from "../format";

describe("repoLanguageCell", () => {
  it("값이 있으면 그대로", () => {
    expect(repoLanguageCell("TypeScript", "2026-09-12T00:00:00.000Z")).toEqual({
      text: "TypeScript",
      known: true,
    });
  });

  it("조회한 적 없으면 '—' — 주 언어가 없는 것과 다르다", () => {
    expect(repoLanguageCell(null, null)).toEqual({ text: "—", known: false });
  });

  it("조회했는데 주 언어가 없으면 '없음' — 대시로 두면 못 받은 것으로 읽힌다", () => {
    expect(repoLanguageCell(null, "2026-09-12T00:00:00.000Z")).toEqual({
      text: "없음",
      known: true,
    });
  });

  it("undefined 도 안 물어본 것으로 본다 — 칸이 아예 안 온 행이다", () => {
    expect(repoLanguageCell(undefined, undefined)).toEqual({
      text: "—",
      known: false,
    });
  });

  it("언어가 있으면 조회시각이 없어도 그 값 — 값 자체가 물어봤다는 증거다", () => {
    expect(repoLanguageCell("Python", null)).toEqual({
      text: "Python",
      known: true,
    });
  });
});
