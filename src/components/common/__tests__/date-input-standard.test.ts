import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * 날짜 입력은 반드시 공통 컴포넌트 `DateInput`을 쓴다.
 *
 * 왜 테스트로 막나:
 * 기본 <input type="date">는 Chrome에서 우측 아이콘을 정확히 눌러야만 달력이 열린다.
 * 칸 아무 데나 눌러도 열리게 하려면 showPicker() 호출이 필요한데, 그걸 매번 손으로
 * 붙이다 보니 같은 코드가 네 곳에 복제됐고 몇 곳은 아예 빠져 사용자가 "달력이 안 뜬다"고
 * 보고했다. 타입 검사도 린트도 이걸 못 잡는다 — 문법은 멀쩡하고 동작만 불편하기 때문이다.
 *
 * 새 날짜 입력이 생기면 이 테스트가 파일·줄을 짚어 실패한다.
 */
const SRC = join(process.cwd(), "src");
const DATE_INPUT_PATH = join(
  "src",
  "components",
  "common",
  "DateInput.tsx",
).replace(/\\/g, "/");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      out.push(...walk(p));
    } else if (p.endsWith(".tsx")) {
      out.push(p);
    }
  }
  return out;
}

/** `<input ... type="date">` 형태의 raw 엘리먼트만 찾는다(DateInput의 type prop은 제외). */
function findRawDateInputs(source: string): number[] {
  const lines = source.split("\n");
  const hits: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/type="(date|datetime-local)"/.test(lines[i])) continue;
    // 위로 거슬러 올라가 이 속성이 붙은 태그가 <input>인지 <DateInput>인지 판별한다.
    for (let j = i; j >= 0 && j > i - 12; j--) {
      const m = /<(input|DateInput)\b/.exec(lines[j]);
      if (!m) continue;
      if (m[1] === "input") hits.push(i + 1);
      break;
    }
  }
  return hits;
}

describe("날짜 입력 표준", () => {
  it('raw <input type="date"> 없이 전부 DateInput을 쓴다', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = file.replace(process.cwd() + "\\", "").replace(/\\/g, "/");
      if (rel === DATE_INPUT_PATH) continue; // 컴포넌트 자신은 예외
      if (rel.includes("__tests__")) continue;
      for (const line of findRawDateInputs(readFileSync(file, "utf8"))) {
        offenders.push(`${rel}:${line}`);
      }
    }
    expect(
      offenders,
      `날짜 입력은 @/components/common/DateInput 을 쓰세요:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("탐지기 자체가 동작한다 — raw input은 잡고 DateInput은 넘긴다", () => {
    expect(findRawDateInputs('  <input\n    type="date"\n  />')).toEqual([2]);
    expect(
      findRawDateInputs('  <DateInput\n    type="datetime-local"\n  />'),
    ).toEqual([]);
  });
});
