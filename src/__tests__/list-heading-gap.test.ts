import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * 목록 제목과 표 사이는 **16px** — `ListPattern` 이 기준이다.
 *
 * 그쪽은 `section p-7` 안에서 `header` 가 `mb-4`(16px) 하나만 가진다. 부모에 gap 이
 * 없으므로 그게 곧 여백이다.
 *
 * 이 값을 세 번 틀렸다(2026-09-01). 우편물 주석의 "표준(28px)" 을 그대로 믿고
 * 부모 `gap-3`(12px)에 `mb-4` 를 더해 28px 을 만들었는데, **화면에 나란히 놓고 보니
 * 표준보다 넓었다.** 주석이 아니라 `ListPattern` 실물을 기준으로 삼는다.
 *
 * 그래서 가드는 "mb-4 가 있는가"가 아니라 **"부모 gap 이 여백을 더하지 않는가"** 까지 본다.
 */
const ROOT = join(process.cwd(), "src/app/dashboard");

/**
 * 목록 패널이 아니어서 이 규칙을 안 받는 곳. **이유를 적어 둔다** — 목록만 늘면
 * 규칙이 유명무실해진다.
 */
const EXEMPT: Record<string, string> = {
  "PricingSheet.tsx":
    "header 가 배경·보더가 있는 띠라 표와 붙는 게 의도된 모양이다.",
  "HandoverWizard.tsx":
    "목록 패널이 아니라 마법사 단계 제목(`1 · 서비스 선택`)이다.",
};

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__") continue;
      out.push(...tsxFiles(p));
    } else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("목록 제목과 표 사이 간격", () => {
  it("제목 아래 16px — 부모 gap 이 더해지지 않는다", () => {
    const bad: string[] = [];
    for (const file of tsxFiles(ROOT)) {
      const base = file.split(/[\\/]/).pop() ?? "";
      if (EXEMPT[base]) continue;

      const src = readFileSync(file, "utf8");
      if (!/<header[^>]*className="[^"]*"/.test(src)) continue;
      if (!/<table\b/.test(src)) continue;

      const header = /<header className="([^"]*)"/.exec(src)?.[1] ?? "";
      if (!/\bmb-4\b/.test(header)) {
        bad.push(`${file.replace(process.cwd(), "")} — header 에 mb-4 없음`);
        continue;
      }
      // **부모 gap 은 여기서 못 잡는다.** JSX 부모를 정규식으로 짚는 건 취약해서,
      // 통째로 잡으면 오탐이 여덟 곳, 좁히면 아무것도 못 잡았다(2026-09-01 둘 다 실측).
      // 그래서 `mb-4` 만 지킨다 — 부모에 `gap-*` 을 두면 그만큼 더해져 16px 을 넘으므로,
      // 새 패널은 `ListPattern` 처럼 **gap 없이 mb-4 만** 둔다.
    }
    expect(
      bad,
      `제목·표 간격이 표준(16px)과 다릅니다:\n${bad.join("\n")}`,
    ).toEqual([]);
  });
});
