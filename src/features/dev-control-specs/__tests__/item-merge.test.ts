import { describe, it, expect } from "vitest";
import { mergeSpecItems } from "../item-merge";
import type { DevControlSpecItem } from "../schemas";

const item = (
  key: string,
  included = true,
  title = "제목",
): DevControlSpecItem => ({ key, title, body: "설명", included });

/**
 * 재생성해도 **운영자가 뺀 결정은 살아남는다.**
 *
 * 안 그러면 "분명히 뺐는데 또 나갔다"가 된다 — 학교로 나가는 문서라 되돌릴 수 없다.
 * `mergeFlags` 와 같은 문제라 같은 해법을 쓴다.
 */
describe("mergeSpecItems", () => {
  it("제외한 항목은 재생성해도 제외로 남는다", () => {
    const prev = [item("a", false)];
    const next = [item("a", true, "새 제목")];
    expect(mergeSpecItems(prev, next)[0].included).toBe(false);
  });

  it("문구는 새것을 쓴다 — 결정만 이어받는다", () => {
    const merged = mergeSpecItems([item("a", false)], [item("a", true, "새 제목")]);
    expect(merged[0].title).toBe("새 제목");
  });

  it("새로 생긴 항목은 기본 포함 — 빠뜨리는 것보다 낫다", () => {
    expect(mergeSpecItems([item("a", false)], [item("b")])[0].included).toBe(true);
  });

  it("사라진 항목은 따라 사라진다 — 코드에 없는 제어를 안내할 수 없다", () => {
    expect(mergeSpecItems([item("a"), item("b")], [item("a")])).toHaveLength(1);
  });

  it("순서는 새것을 따른다", () => {
    const merged = mergeSpecItems([item("b"), item("a")], [item("a"), item("b")]);
    expect(merged.map((i) => i.key)).toEqual(["a", "b"]);
  });

  it("이전이 없어도 동작한다 — 첫 생성", () => {
    expect(mergeSpecItems([], [item("a")])[0].included).toBe(true);
  });
});
