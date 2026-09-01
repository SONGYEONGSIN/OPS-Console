import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * 목록 패널 제목은 **`text-xl font-bold`** — 우편물 발송목록이 기준이다.
 *
 * 간격을 표준(28px)으로 맞췄는데도 "붙어 보인다"는 지적이 이어졌다(2026-09-01).
 * 재보니 제목이 `text-base font-semibold`(16px)라 **작은 제목이 표를 끌어당겨**
 * 같은 여백도 좁아 보였다. 여백만 재고 글자 크기를 안 봤던 것이다.
 *
 * 크기가 같아야 여백도 같아 보인다.
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

describe("목록 패널 제목", () => {
  it("표 위 제목은 text-xl font-bold 다", () => {
    const bad: string[] = [];
    for (const file of tsxFiles(ROOT)) {
      const src = readFileSync(file, "utf8");
      // 제목 header 바로 아래 표가 오는 패널만 본다.
      if (!/<header[^>]*className="[^"]*"/.test(src)) continue;
      if (!/<table\b/.test(src)) continue;

      for (const m of src.matchAll(/<h3 className="([^"]*)"/g)) {
        const cls = m[1];
        if (!/\btext-xl\b/.test(cls) || !/\bfont-bold\b/.test(cls)) {
          bad.push(`${file.replace(process.cwd(), "")} — ${cls}`);
        }
      }
    }
    expect(
      bad,
      `제목이 작아 표에 붙어 보입니다. text-xl font-bold 로 맞추세요:\n${bad.join("\n")}`,
    ).toEqual([]);
  });
});
