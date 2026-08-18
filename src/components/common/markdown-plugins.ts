import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";

/**
 * 마크다운 렌더 공통 설정. 어시스턴트 채팅과 지식망 문서 뷰어가 함께 쓴다.
 *
 * **`singleTilde: false`가 이 파일의 존재 이유다.** remark-gfm 기본값은 true라
 * `~text~`도 취소선이 된다. 한국어 운영 문서는 범위를 물결표로 쓴다 — 인수인계
 * 원문에 `Etc0~Etc8`과 `3~5번째 자리`가 있었고, 두 물결표가 짝을 이뤄 **그 사이가
 * 통째로 그어진 채** 화면에 나왔다(2026-08-18 실측).
 *
 * GFM 표준 취소선은 `~~text~~`이므로 끄는 쪽이 규격에도 맞다.
 *
 * 두 화면이 각자 설정하면 한쪽만 고쳐진다. 그래서 한 곳에 둔다.
 */
export const MARKDOWN_REMARK_PLUGINS: PluggableList = [
  [remarkGfm, { singleTilde: false }],
];
