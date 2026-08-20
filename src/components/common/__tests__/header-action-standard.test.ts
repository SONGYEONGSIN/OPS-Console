import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * 목록 헤더 액션 버튼은 `HeaderActionButton`(또는 그 클래스 상수)을 쓴다.
 *
 * 왜 테스트로 막나:
 * 표준이 **컴포넌트가 아니라 복사해 쓰는 클래스 문자열**이었다. `ListPattern`에
 * 인라인으로 있었고, 미수채권이 "같은 문자열"이라는 주석과 함께 베껴 썼고, 세 번째로
 * 옮겨 적을 때 결국 다른 치수(`py-1.5 text-sm`)가 들어가 우편물 탭만 버튼이 커
 * 보였다(2026-08-20). 타입 검사도 린트도 이걸 못 잡는다 — 문법은 멀쩡하다.
 *
 * 새로 베껴 쓰면 이 테스트가 파일·줄을 짚어 실패한다.
 */
const SRC = join(process.cwd(), "src");
/** 정의하는 파일 자신은 예외 — 문자열을 담는 게 이 파일의 존재 이유다. */
const OWNER = "src/components/common/HeaderActionButton.tsx";

/**
 * 표준 문자열 **그대로**를 찾는다.
 *
 * 넓게 잡으면(색+치수만 보면) 다른 슬롯까지 걸린다 — 인스펙터 본문 링크는
 * `py-2 text-sm`, 자동화 카드 버튼은 `inline-flex w-fit` 으로 같은 색을 쓰지만
 * 헤더 액션이 아니다. 실제로 번진 방식은 **문자열 통째 복사**였으므로 그것만 막는다.
 */
const MARKER = "bg-vermilion px-3 py-1 text-xs font-medium text-cream";

function toRelPosix(absPath: string): string {
  return relative(process.cwd(), absPath).split(sep).join("/");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|jsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("헤더 액션 버튼 표준", () => {
  it("클래스 문자열을 베껴 쓴 곳이 없다", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = toRelPosix(file);
      if (rel === OWNER) continue;
      // 테스트는 클래스를 단언하려고 문자열을 적는다 — 그건 복제가 아니다.
      if (rel.includes("__tests__")) continue;
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        if (line.includes(MARKER)) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(
      offenders,
      `헤더 액션 버튼은 @/components/common/HeaderActionButton 을 쓰세요:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
