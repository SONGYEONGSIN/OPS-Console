import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 탭 **이름과 순서**를 소스 원문으로 고정한다.
 *
 * 이름은 사용자가 정한 말이다(2026-09-21) — `배분현황`→`배정현황`, `제안`→`3월배정`.
 * `제안` 은 무엇을 제안하는지 말하지 않아 화면을 열기 전엔 알 수 없었고, `배분` 은
 * 나누는 행위인데 화면은 나뉜 결과를 보는 자리다.
 *
 * 순서도 사용자가 정했다 — `3월배정` 이 두 번째다. 한 해 배정이 3월에 통째로 정해지고
 * 신규배정은 그 뒤에 들어온 것만 다루므로, 읽는 순서가 곧 일의 순서다.
 *
 * **원문을 읽어 대조한다.** 컴포넌트를 렌더해 라벨을 찾으면 `TABS` 를 안 거치는 하드코딩
 * 라벨이 생겨도 통과한다(탭 이름이 두 벌이 되는 자리다 — `page.tsx:236` 주석 참조).
 */
const SRC = readFileSync(
  resolve(__dirname, "../page.tsx"),
  "utf8",
);

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

describe("업무배정 탭", () => {
  it("이름과 순서 — 배정현황 · 3월배정 · 신규배정", () => {
    expect(declaredTabs()).toEqual([
      { key: "workload", label: "배정현황" },
      { key: "proposals", label: "3월배정" },
      { key: "newcomers", label: "신규배정" },
    ]);
  });

  it("옛 이름이 화면에 남아 있지 않다", () => {
    // 한 곳만 고치면 탭은 새 이름인데 본문은 옛 이름이라 같은 것을 두 말로 부른다.
    expect(SRC).not.toContain("배분현황");
  });

  it("기본 탭은 배정현황이다 — 흐름이 모니터링이다", () => {
    expect(declaredTabs()[0].key).toBe("workload");
  });

  it("페이지 설명이 탭 이름과 같은 말을 쓴다", () => {
    // 탭만 고치면 머리말은 옛 이름으로 남아, 같은 것을 두 말로 부른다.
    const meta = readFileSync(
      resolve(__dirname, "../../_data/page-meta-config.ts"),
      "utf8",
    );
    // `headline: { … },` 이 먼저 닫히므로 `indexOf("},")` 로는 설명 앞에서 잘린다.
    // `description:` 뒤의 문자열만 집는다.
    const entry = meta.slice(meta.indexOf('"work-assignment": {'));
    const desc = /description:\s*\n?\s*"([^"]+)"/.exec(entry)?.[1] ?? "";
    expect(desc).not.toBe("");
    expect(desc).not.toContain("배분현황");
    expect(desc).toContain("배정현황");
    expect(desc).toContain("3월");
  });
});
