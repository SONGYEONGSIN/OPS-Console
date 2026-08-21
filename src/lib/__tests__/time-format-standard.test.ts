import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * 시각은 **24시간제**로 쓴다.
 *
 * 왜 테스트로 막나:
 * `Intl.DateTimeFormat("ko-KR", { hour: "2-digit" })` 는 기본이 **12시간제**라
 * `오후 04:48` 이 나온다. 같은 화면의 다른 열은 `15:44` 로 나와, 같은 표 안에서
 * 표기가 갈렸다(2026-08-22 우편물). 레포의 30곳은 `hour12: false` 를 명시하는데
 * 안 쓴 2곳만 12시간제가 됐다 — 문법도 타입도 이걸 못 잡는다.
 */
const SRC = join(process.cwd(), "src");
/**
 * 사람에게 보이는 한국어 시각은 `kstFormat` 으로만 찍는다.
 *
 * **`ko-KR` 만 본다.** 12시간제 기본값은 한국어 로캘의 함정이고, `en-CA`(YYYY-MM-DD
 * 기계용 키)·`en-GB`(원래 24시간제)는 다른 목적으로 일부러 쓴다.
 */
const DIRECT_WITH_HOUR = /new Intl\.DateTimeFormat\(\s*["']ko(-KR)?["'][^)]*?hour:/s;

function toRelPosix(absPath: string): string {
  return relative(process.cwd(), absPath).split(sep).join("/");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/**
 * 시각을 찍는데 24시간제를 안 정한 곳.
 *
 * `DateTimeFormat` 옵션은 여러 줄에 흩어지므로 **파일 단위**로 본다. 한 파일에
 * 포맷터가 여럿이면 놓칠 수 있지만, 그 경우 대개 같은 관례를 쓴다.
 */
export function lacksExplicit24h(source: string): boolean {
  return DIRECT_WITH_HOUR.test(source);
}

describe("시각 표기 표준 — 24시간제", () => {
  it("시각을 찍는 곳은 12시간제로 새지 않는다", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = toRelPosix(file);
      if (rel.includes("__tests__")) continue;
      if (lacksExplicit24h(readFileSync(file, "utf8"))) offenders.push(rel);
    }
    expect(
      offenders,
      `시각은 kstFormat 으로 찍습니다 (@/lib/kst-format):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("kstFormat 을 쓰면 통과 — 24시간제가 딸려 온다", () => {
    expect(
      lacksExplicit24h(`kstFormat({ hour: "2-digit", minute: "2-digit" })`),
    ).toBe(false);
  });

  it("기계용 키(en-CA)는 막지 않는다 — 표기가 아니라 값이다", () => {
    expect(
      lacksExplicit24h(
        `new Intl.DateTimeFormat("en-CA", { hour: "2-digit", timeZone: "Asia/Seoul" })`,
      ),
    ).toBe(false);
  });

  it("시각을 안 찍으면 상관없다 — 날짜만 쓰는 곳까지 막지 않는다", () => {
    expect(
      lacksExplicit24h(`new Intl.DateTimeFormat("ko-KR", { month: "2-digit" })`),
    ).toBe(false);
  });

  it("직접 부르면서 시각을 찍으면 잡는다 — hour12 를 빠뜨릴 수 있다", () => {
    expect(
      lacksExplicit24h(
        `new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", hour12: false })`,
      ),
    ).toBe(true);
  });
});
