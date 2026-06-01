import { describe, it, expect } from "vitest";
import { aliasRowsToMap } from "../alias-queries";

describe("aliasRowsToMap", () => {
  it("alias 행 배열을 {key: value} 맵으로 변환", () => {
    const map = aliasRowsToMap([
      { alias_key: "서강국제대학원", alias_value: "서강대" },
      { alias_key: "한양MBA", alias_value: "한양대" },
    ]);
    expect(map).toEqual({ 서강국제대학원: "서강대", 한양MBA: "한양대" });
  });

  it("빈 배열 → 빈 맵", () => {
    expect(aliasRowsToMap([])).toEqual({});
  });

  it("key/value 누락 행은 무시", () => {
    const map = aliasRowsToMap([
      { alias_key: "", alias_value: "x" },
      { alias_key: "a", alias_value: "" },
      { alias_key: "ok", alias_value: "타깃" },
    ]);
    expect(map).toEqual({ ok: "타깃" });
  });
});
