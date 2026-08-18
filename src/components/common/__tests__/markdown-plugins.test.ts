import { describe, it, expect } from "vitest";
import { MARKDOWN_REMARK_PLUGINS } from "../markdown-plugins";
import remarkGfm from "remark-gfm";

/**
 * 물결표 하나(`~`)를 취소선으로 읽지 않게 한다.
 *
 * remark-gfm의 `singleTilde` 기본값이 true라 `~text~`도 취소선이 된다. 한국어 운영
 * 문서는 범위를 `~`로 쓴다 — 인수인계 원문에 `Etc0~Etc8`과 `3~5번째 자리`가 있었고,
 * 두 물결표가 짝을 이뤄 **그 사이가 통째로 그어져** 화면에 나왔다(2026-08-18 실측).
 *
 * GFM 표준은 `~~text~~`이므로 끄는 쪽이 규격에도 맞다.
 */
describe("MARKDOWN_REMARK_PLUGINS", () => {
  it("remark-gfm을 singleTilde 끈 채로 넘긴다", () => {
    const entry = MARKDOWN_REMARK_PLUGINS[0];
    expect(Array.isArray(entry)).toBe(true);
    const [plugin, options] = entry as [unknown, { singleTilde?: boolean }];
    expect(plugin).toBe(remarkGfm);
    expect(options.singleTilde).toBe(false);
  });

  it("플러그인이 하나뿐이다 — 늘리면 렌더가 갈린다", () => {
    expect(MARKDOWN_REMARK_PLUGINS).toHaveLength(1);
  });
});
