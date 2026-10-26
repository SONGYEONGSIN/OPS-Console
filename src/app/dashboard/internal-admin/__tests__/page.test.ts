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
const SRC = readFileSync(resolve(__dirname, "../page.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

/** `TABS` 배열 안의 `key`/`label` 쌍을 선언 순서대로. */
function declaredTabs(): { key: string; label: string }[] {
  const block = SRC.slice(SRC.indexOf("const TABS = ["));
  const body = block.slice(0, block.indexOf("] as const;"));
  const out: { key: string; label: string }[] = [];
  const re = /key:\s*"([^"]+)"[\s\S]*?label:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) out.push({ key: m[1], label: m[2] });
  return out;
}

describe("내부관리자 페이지", () => {
  it("탭 이름·순서 — 추가 제출은 없다", () => {
    expect(declaredTabs()).toEqual([
      { key: "overview", label: "개요" },
      { key: "schools", label: "학교" },
      { key: "numbers", label: "발신번호" },
      { key: "checks", label: "확인 필요" },
    ]);
    expect(SRC).not.toContain("추가 제출");
  });

  it("기본 탭은 학교", () =>
    expect(SRC).toMatch(/return hit \? hit\.key : "schools"/));

  it('가드는 requireMenu("internal-admin") 하나', () => {
    expect(SRC).toMatch(/const slug = "internal-admin"/);
    expect(SRC).toMatch(/requireMenu\(slug\)/);
    expect(SRC).not.toMatch(/permission\s*[=!]==?\s*["']admin["']/);
  });

  it("원천 실패는 오류 화면", () => expect(SRC).toMatch(/<SourceError/));
});
