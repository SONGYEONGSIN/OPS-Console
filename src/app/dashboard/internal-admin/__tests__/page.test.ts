import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 탭·가드·오류 화면을 **소스 원문으로** 고정한다.
 *
 * 렌더해서 라벨을 찾으면 `TABS` 를 안 거치는 하드코딩 라벨이 생겨도 통과하고,
 * 가드가 두 벌이 된 것도 렌더 테스트로는 안 잡힌다 — 양쪽 다 정상 화면이다.
 *
 * **주석을 지우고 대조한다.** 안 지우면 *왜 그렇게 안 했는지* 적은 주석이 금지
 * 패턴에 걸려, 설명을 지워야 초록이 되는 테스트가 된다.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const SRC = stripComments(
  readFileSync(resolve(__dirname, "../page.tsx"), "utf8"),
);
const TABS_SRC = stripComments(
  readFileSync(resolve(__dirname, "../tabs.ts"), "utf8"),
);

describe("내부관리자 페이지", () => {
  it("추가 제출 탭은 없다", () =>
    expect(SRC).not.toContain("추가 제출"));

  it("기본 뷰는 학교", () =>
    expect(TABS_SRC).toMatch(/DEFAULT_VIEW: View = "schools"/));

  it("메인 탭 한 줄 + 서브 탭 한 줄, 해석은 resolveView 하나", () => {
    expect(SRC).toMatch(/<PageTabs active=\{main\} tabs=\{MAIN_TABS\}/);
    expect(SRC).toMatch(/<PageTabs active=\{view\} size="sm" tabs=\{SUB_VIEWS\}/);
    expect(SRC).toMatch(/resolveView\(/);
    expect(SRC).not.toMatch(/const TABS = \[/);
  });

  it("개요(견본) 뷰는 없다 — 가짜 데이터·ProjectPattern 을 안 쓴다", () => {
    expect(SRC).not.toMatch(/overview/);
    expect(SRC).not.toMatch(/ProjectPattern|getPatternMockData/);
  });

  it('가드는 requireMenu("internal-admin") 하나', () => {
    expect(SRC).toMatch(/const slug = "internal-admin"/);
    expect(SRC).toMatch(/requireMenu\(slug\)/);
    expect(SRC).not.toMatch(/permission\s*[=!]==?\s*["']admin["']/);
  });

  it("원천 실패는 오류 화면", () => expect(SRC).toMatch(/<SourceError/));
});
