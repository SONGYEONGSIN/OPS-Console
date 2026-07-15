import { describe, it, expect } from "vitest";
import { mergeFlags } from "../flag-merge";
import type { DevControlFlag } from "../schemas";

const f = (
  key: string,
  over: Partial<DevControlFlag> = {},
): DevControlFlag => ({
  key,
  label: "지난 연도 날짜",
  snippet: "2025. 9. 9.",
  severity: "warn",
  checked: false,
  note: "",
  ...over,
});

describe("mergeFlags", () => {
  it("동일 key는 checked/note 보존, 신규 항목은 초기값", () => {
    const prev = [f("k1", { checked: true, note: "확인함" })];
    const next = [f("k1", { snippet: "갱신됨" }), f("k2")];
    const out = mergeFlags(prev, next);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      key: "k1",
      checked: true,
      note: "확인함",
      snippet: "갱신됨",
    });
    expect(out[1]).toMatchObject({ key: "k2", checked: false, note: "" });
  });
  it("사라진 key는 제거된다", () => {
    const out = mergeFlags([f("gone", { checked: true })], [f("k2")]);
    expect(out.map((x) => x.key)).toEqual(["k2"]);
  });
});
