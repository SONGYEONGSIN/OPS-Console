import { describe, it, expect } from "vitest";
import { resolvePromotionPath } from "../promote-guard";

/**
 * `제안/` 에서 **나가는 방향만** 연다. 본 위치 문서를 옮기는 건 여러 사람이 함께
 * 쓰는 파일이라, 버튼 한 번으로 남의 문서가 소리 없이 움직이면 안 된다.
 *
 * 순수 함수로 둔 이유: 액션 안에 묻으면 탈출 시도를 테스트할 수 없다.
 */
describe("resolvePromotionPath", () => {
  it("제안 폴더에서 분류 폴더로 옮길 자리를 준다", () => {
    expect(resolvePromotionPath("제안/취업규칙 요점.md", "규칙")).toEqual({
      fileName: "취업규칙 요점.md",
      toPath: "규칙/취업규칙 요점.md",
    });
  });

  it("본 위치 문서는 못 옮긴다 — 나가는 방향만 연다", () => {
    expect(() => resolvePromotionPath("규칙/이미 있는 것.md", "개념")).toThrow(
      /제안 폴더/,
    );
  });

  it("상위 참조를 막는다", () => {
    expect(() => resolvePromotionPath("제안/../규칙/x.md", "규칙")).toThrow(
      /상위 참조/,
    );
  });

  it("접두 위장을 막는다 — 구분자까지 붙여 본다", () => {
    expect(() => resolvePromotionPath("제안-사칭/x.md", "규칙")).toThrow(
      /제안 폴더/,
    );
  });

  it(".md 만 옮긴다", () => {
    expect(() => resolvePromotionPath("제안/그림.png", "규칙")).toThrow(/\.md/);
  });

  it("모르는 분류로는 못 옮긴다 — 볼트에 없는 폴더가 생기면 안 된다", () => {
    expect(() => resolvePromotionPath("제안/x.md", "아무거나")).toThrow(
      /분류/,
    );
  });

  it("제안 폴더로 되돌리는 것도 막는다", () => {
    expect(() => resolvePromotionPath("제안/x.md", "제안")).toThrow(/분류/);
  });

  it("경로가 비면 막는다", () => {
    expect(() => resolvePromotionPath("  ", "규칙")).toThrow(/비었/);
  });
});
