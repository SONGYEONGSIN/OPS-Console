import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * webUrl 조회는 **한 곳만** 한다.
 *
 * 공용 헬퍼(`lib/microsoft/workbook-web-url.ts`)가 있는데도 공문관리대장이
 * fetch 를 처음부터 다시 짜 다섯 번째 사본이 돼 있었다(#1120 통합에서 누락).
 * 그러면 공용 함수를 고쳐도 그쪽만 옛 동작으로 남는다 — 헬퍼 import 를 보는
 * 가드로는 못 잡힌다. **호출 자체**를 본다.
 *
 * 실측(2026-09-12): 이 문자열을 가진 파일은 헬퍼와 그 테스트뿐이다.
 */
const SRC = join(process.cwd(), "src");
const ALLOWED = [
  "src/lib/microsoft/workbook-web-url.ts",
  "src/lib/microsoft/__tests__/workbook-web-url.test.ts",
  // 이 가드 자신 — 찾는 문자열이 본문에 들어 있다.
  "src/features/workbook/__tests__/single-weburl-owner.test.ts",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("webUrl 조회 단일 소유", () => {
  it("공용 헬퍼 밖에서 webUrl 을 직접 묻지 않는다", () => {
    const offenders = walk(SRC)
      .filter((f) => readFileSync(f, "utf8").includes("select=webUrl"))
      .map((f) => relative(process.cwd(), f).split(sep).join("/"))
      .filter((r) => !ALLOWED.includes(r));
    expect(
      offenders,
      `fetchWorkbookWebUrl 을 쓰세요:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
