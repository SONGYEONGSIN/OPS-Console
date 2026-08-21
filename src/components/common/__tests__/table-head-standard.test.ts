import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * 목록 표 머리글은 한 가지 치수를 쓴다.
 *
 * 레포의 37곳이 같은 문자열을 쓰는데 새로 만든 표만 `text-2xs` 로 들어가 제목과
 * 표 사이가 좁아 보였다(2026-08-21 발송목록). 눈으로만 맞추면 다음에 또 어긋난다.
 *
 * 여기서 막는 건 **다른 치수가 새로 들어오는 것**이다. 문자열이 여러 곳에 있는 건
 * 표가 화면마다 제 모양을 갖는 구조라 어쩔 수 없다 — 컴포넌트로 묶기엔 열 구성이
 * 화면마다 다르다.
 */
const SRC = join(process.cwd(), "src");

/** 표준. 37곳이 이걸 쓴다. */
const STANDARD = "text-left text-xs uppercase tracking-[0.06em] text-muted";
/** 같은 자리인데 치수만 다른 것 — 이게 어긋남이다. */
const OFF = /uppercase tracking-\[0\.0\d+em\] text-muted/;

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

describe("목록 표 머리글 표준", () => {
  it("치수가 다른 머리글이 없다", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = toRelPosix(file);
      if (rel.includes("__tests__")) continue;
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((line, i) => {
          // 표 머리글 줄인지: thead 안의 tr 스타일 조합을 본다.
          if (!line.includes("border-b border-line")) return;
          if (!OFF.test(line)) return;
          if (line.includes(STANDARD)) return;
          offenders.push(`${rel}:${i + 1}`);
        });
    }
    expect(
      offenders,
      `목록 표 머리글은 "${STANDARD}" 를 쓰세요:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
