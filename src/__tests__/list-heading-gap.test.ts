import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * 목록 제목과 표 사이는 **28px**(ListPattern 표준).
 *
 * 세 번 지적받은 자리다 — 우편물 발송목록(2026-08-22), 전도금, TIP 후보(2026-09-01).
 * 매번 사람이 눈으로 보고 알려줘야 했다. 표준이 이미 있는데 새로 만드는 게 문제라,
 * **새 목록 화면이 생겨도 자동으로 걸리게** 훑는다.
 *
 * 셈: 부모가 `flex flex-col gap-3`(12px)이면 `mb-4`(16px)를 더해 28px.
 * `mb-7`(28px)로 두면 40px 이 돼 표준보다 넓다.
 */
const ROOT = join(process.cwd(), "src/app/dashboard");

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
  it("제목 header 를 둔 표 화면은 아래 간격을 명시한다", () => {
    const bad: string[] = [];
    for (const file of tsxFiles(ROOT)) {
      const src = readFileSync(file, "utf8");
      // 제목 header 바로 아래 표가 오는 화면만 본다.
      if (!/<header[^>]*className="[^"]*"/.test(src)) continue;
      if (!/<table\b/.test(src)) continue;
      // 부모가 gap 으로 띄우는 구조에서만 이 셈이 성립한다.
      if (!/flex flex-col gap-3/.test(src)) continue;

      const header = /<header className="([^"]*)"/.exec(src)?.[1] ?? "";
      // mb-4 = 16px. 부모 12px 과 합쳐 28px 이 된다.
      if (!/\bmb-4\b/.test(header)) bad.push(file.replace(process.cwd(), ""));
    }
    expect(
      bad,
      `제목과 표가 붙어 보입니다. header 에 mb-4 를 더해 28px 을 만드세요:\n${bad.join("\n")}`,
    ).toEqual([]);
  });
});
