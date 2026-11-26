import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * 여러 줄 입력창(`<textarea>`)은 **내용만큼 늘어난다** — globals.css base 레이어의
 * 전역 규칙(`field-sizing: content` + rows 기반 최소 높이)이 해 준다.
 *
 * 왜 테스트로 막나:
 * 칸마다 붙이는 방식은 붙이는 걸 잊는 날 끝난다(사용자 지시 2026-11-26 — 앞으로
 * 만드는 칸도 무조건). 전역 규칙을 이기는 건 고정 높이뿐이라 그것만 막는다.
 * 높이는 `rows`(빈 칸 최소 줄 수)와 `max-h-*`(상한)로만 정한다.
 */
const SRC = join(process.cwd(), "src");
const GLOBALS_CSS = join(SRC, "app", "globals.css");

function toRelPosix(absPath: string): string {
  return relative(process.cwd(), absPath).split(sep).join("/");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** 따옴표 하나를 건너뛰고 닫는 따옴표 다음 위치를 돌려준다. */
function skipQuoted(source: string, start: number): number {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length && source[i] !== quote) {
    i += source[i] === "\\" ? 2 : 1;
  }
  return i + 1;
}

/**
 * `<textarea` 여는 태그의 끝(`>` 다음) 위치. 중괄호 안(`onChange={(e) => …}`)의
 * `>` 와 따옴표·주석 안의 `>` 는 태그 끝이 아니다.
 */
function openTagEnd(source: string, start: number): number {
  let depth = 0;
  let i = start + 1;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '"' || c === "'" || c === "`") {
      i = skipQuoted(source, i);
      continue;
    }
    if (c === "/" && next === "/") {
      i = source.indexOf("\n", i) + 1 || source.length;
      continue;
    }
    if (c === "/" && next === "*") {
      i = source.indexOf("*/", i) + 2;
      continue;
    }
    if (c === ">" && depth === 0) return i + 1;
    if (c === "{") depth++;
    if (c === "}") depth--;
    i++;
  }
  return source.length;
}

function stripComments(tag: string): string {
  return tag.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** 변형 접두(`md:`·`focus:`)와 `!` 를 뗀 유틸이 `h-` 로 시작하면 고정 높이다. */
function hasFixedHeightClass(tag: string): boolean {
  return tag
    .split(/[\s"'`{}()]+/)
    .map((token) => token.split(":").pop() ?? "")
    .some((utility) => /^!?h-/.test(utility));
}

function hasFixedHeight(tag: string): boolean {
  const code = stripComments(tag);
  return (
    hasFixedHeightClass(code) ||
    /\bfield-sizing-fixed\b/.test(code) ||
    /style=\{\{[^}]*\bheight\s*:/.test(code)
  );
}

/** 고정 높이가 걸린 `<textarea` 의 줄 번호. */
export function findFixedHeightTextareas(source: string): number[] {
  const hits: number[] = [];
  const re = /<textarea\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const tag = source.slice(m.index, openTagEnd(source, m.index));
    if (hasFixedHeight(tag)) {
      hits.push(source.slice(0, m.index).split("\n").length);
    }
  }
  return hits;
}

/** `header` 다음 첫 `{` 부터 짝이 맞는 `}` 까지의 안쪽. 없으면 null. */
function blockAfter(css: string, header: RegExp): string | null {
  const m = header.exec(css);
  if (!m) return null;
  const open = css.indexOf("{", m.index + m[0].length - 1);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  return null;
}

/** `@supports (field-sizing: content)` 안 `textarea` 선택자의 선언부. 없으면 null. */
export function findAutogrowRule(css: string): string | null {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const supports = blockAfter(
    code,
    /@supports\s*\(\s*field-sizing\s*:\s*content\s*\)\s*\{/,
  );
  if (supports === null) return null;
  return blockAfter(supports, /(^|[\s;{}])textarea\s*\{/);
}

describe("여러 줄 입력창 자동 늘림 표준", () => {
  describe("스캐너", () => {
    it("rows·min-h·max-h 는 허용한다", () => {
      const ok = `<textarea rows={3} className="min-h-16 max-h-80 w-full px-2 py-1" />`;
      expect(findFixedHeightTextareas(ok)).toEqual([]);
    });

    it("이미 자동인 칸(field-sizing-content)은 허용한다", () => {
      const ok = `<textarea className="field-sizing-content min-h-[8rem]" />`;
      expect(findFixedHeightTextareas(ok)).toEqual([]);
    });

    it("style 의 minHeight·maxHeight 는 허용한다", () => {
      const ok = `<textarea style={{ minHeight: 40, maxHeight: 200 }} />`;
      expect(findFixedHeightTextareas(ok)).toEqual([]);
    });

    it("h-* 를 잡는다", () => {
      expect(
        findFixedHeightTextareas(`<textarea className="w-full h-40" />`),
      ).toEqual([1]);
    });

    it("반응형·상태 접두가 붙은 h-* 와 h-[…] 를 잡는다", () => {
      expect(
        findFixedHeightTextareas(`<textarea className="md:h-32" />`),
      ).toEqual([1]);
      expect(
        findFixedHeightTextareas(`<textarea className="h-[120px]" />`),
      ).toEqual([1]);
      expect(
        findFixedHeightTextareas(`<textarea className="lg:focus:!h-10" />`),
      ).toEqual([1]);
    });

    it("field-sizing-fixed 를 잡는다", () => {
      expect(
        findFixedHeightTextareas(`<textarea className="field-sizing-fixed" />`),
      ).toEqual([1]);
    });

    it("style={{ height }} 를 잡는다", () => {
      expect(
        findFixedHeightTextareas(`<textarea style={{ height: 120 }} />`),
      ).toEqual([1]);
    });

    it("여러 줄로 흩어지고 속성 안에 => 가 있어도 태그 끝까지 본다", () => {
      const spread = [
        `<div>`,
        `  <textarea`,
        `    onChange={(e) => setText(e.target.value)}`,
        `    // 이 주석의 h-99 는 클래스가 아니다`,
        `    rows={4}`,
        `    className="w-full h-24 px-2"`,
        `  />`,
        `</div>`,
      ].join("\n");
      expect(findFixedHeightTextareas(spread)).toEqual([2]);
    });

    it("태그가 끝난 뒤의 h-* 는 textarea 것이 아니다", () => {
      const after = `<textarea rows={2} onChange={(e) => go(e)} />\n<div className="h-10" />`;
      expect(findFixedHeightTextareas(after)).toEqual([]);
    });
  });

  it("레포의 textarea 에 고정 높이가 없다", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = toRelPosix(file);
      if (rel.includes("__tests__")) continue;
      for (const line of findFixedHeightTextareas(readFileSync(file, "utf8"))) {
        offenders.push(`${rel}:${line}`);
      }
    }
    expect(
      offenders,
      `textarea 높이는 rows 와 max-h-* 로만 정합니다(고정 높이는 자동 늘림을 끕니다):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  describe("globals.css 전역 규칙", () => {
    it("주석 처리된 규칙은 규칙이 아니다", () => {
      const commented = `/* @supports (field-sizing: content) { textarea { field-sizing: content; } } */`;
      expect(findAutogrowRule(commented)).toBeNull();
    });

    it("@supports (field-sizing: content) 안 textarea 에 자동 늘림과 rows 최소 높이가 있다", () => {
      const rule = findAutogrowRule(readFileSync(GLOBALS_CSS, "utf8"));
      expect(
        rule,
        "globals.css 에 @supports (field-sizing: content) { textarea { … } } 가 없습니다",
      ).not.toBeNull();
      expect(rule).toMatch(/field-sizing\s*:\s*content\s*;/);
      expect(rule).toMatch(/min-height\s*:[^;]*attr\(\s*rows\b/);
    });
  });
});
