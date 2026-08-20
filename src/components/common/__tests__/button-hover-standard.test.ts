import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * 버튼 호버는 **검정 배경 + cream 글씨**(`hover:bg-ink hover:text-cream`)다.
 *
 * 왜 테스트로 막나:
 * 사용자가 정한 기본 디자인 규칙인데(2026-06-14) 어디에도 안 적혀 있어서, 새 버튼이
 * 생길 때마다 약한 톤(`hover:bg-washi`)으로 들어갔다. 20곳까지 벌어진 뒤에야
 * "표준 색이 있냐"는 질문으로 드러났다. 헤더 버튼도 같은 식으로 두 번 갈렸다(#1047·#1049).
 *
 * `<button>` `<label>` `<a>` 만 본다. `<div>` `<Link>` 로 만든 **면**(카드·행)은
 * 다른 규칙이다 — 카드 전체가 검게 변하면 화면이 번쩍인다.
 */
const SRC = join(process.cwd(), "src");
/** 약한 호버 톤 — 버튼에는 쓰지 않는다. */
const WEAK = /hover:bg-washi(-raised)?\b/;
/** 이 태그로 열린 요소만 버튼으로 본다. */
const CLICKABLE = /<(button|label|a)\b/;
/** 여는 태그를 거슬러 찾을 때 보는 줄 수. 속성이 많아도 이 안에 들어온다. */
const LOOKBACK = 14;

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

/** 약한 호버가 걸린 클릭 요소의 줄 번호. 여는 태그가 button/label/a 일 때만. */
export function findWeakButtonHovers(source: string): number[] {
  const lines = source.split("\n");
  const hits: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!WEAK.test(lines[i])) continue;
    for (let j = i; j >= 0 && j > i - LOOKBACK; j--) {
      const open = /<(button|label|a|div|li|Link|section|td|tr)\b/.exec(lines[j]);
      if (!open) continue;
      // 가장 가까운 여는 태그가 클릭 요소일 때만 위반이다. div·Link 면 면(面)이다.
      if (CLICKABLE.test(open[0])) hits.push(i + 1);
      break;
    }
  }
  return hits;
}

describe("버튼 호버 표준", () => {
  it("버튼에 약한 호버 톤을 쓰지 않는다", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = toRelPosix(file);
      if (rel.includes("__tests__")) continue;
      for (const line of findWeakButtonHovers(readFileSync(file, "utf8"))) {
        offenders.push(`${rel}:${line}`);
      }
    }
    expect(
      offenders,
      `버튼 호버는 'hover:bg-ink hover:text-cream' 입니다:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("면(카드·행)은 걸리지 않는다 — 카드가 검게 변하면 화면이 번쩍인다", () => {
    const card = `<div className="border transition-colors hover:bg-washi-raised">`;
    expect(findWeakButtonHovers(card)).toEqual([]);
  });

  it("버튼은 잡는다", () => {
    const button = `<button className="border px-3 hover:bg-washi">저장</button>`;
    expect(findWeakButtonHovers(button)).toEqual([1]);
  });

  it("여는 태그가 여러 줄로 흩어져 있어도 잡는다", () => {
    const spread = [
      `<label`,
      `  className="inline-block cursor-pointer border"`,
      `  data-x="1"`,
      `>`,
      `  <span className="hover:bg-washi">파일 선택</span>`,
    ].join("\n");
    // span 은 목록에 없어 가장 가까운 여는 태그가 label 로 잡힌다.
    expect(findWeakButtonHovers(spread)).toEqual([5]);
  });
});
