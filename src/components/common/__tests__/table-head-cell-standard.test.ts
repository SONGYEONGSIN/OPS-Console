import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * 목록 표 머리글 칸(`th`)은 좌우 여백을 갖고 굵기를 더하지 않는다.
 *
 * 앞선 가드(`table-head-standard`)는 `tr` 만 봤다. 그래서 `tr` 을 고친 뒤에도
 * 발송목록 머리글이 여전히 달라 보였다(2026-08-21) — `font-medium` 이 붙어 굵기가
 * 다르고, `px-3` 대신 `pr-3` 이라 **왼쪽 여백이 없어 아래 행과 세로가 어긋났다.**
 *
 * 처음엔 같은 블록의 `td` 와 대조하려 했는데, 행을 컴포넌트로 그리는 표(`LedgerTable`)는
 * `tbody` 안에 `td` 가 없어 **아무것도 못 잡았다.** 역검증에서 드러났다 — 옛 상태로
 * 되돌려도 통과했다. 그래서 `th` 만으로 판정한다.
 *
 * 대상은 **목록 표**뿐이다. 견적서·경위서·뉴스레터처럼 문서를 그리는 표는 칸마다
 * 폭과 굵기가 의미를 갖는다(번호칸 `w-8`, 라벨 열 굵게) — 같은 잣대로 보면 안 된다.
 * 목록 표는 머리글 `tr` 에 표준 스타일이 붙어 있어 그걸로 가른다.
 *
 * **절대 치수는 강요하지 않는다.** 인스펙터 안 8열 편집표(`ReceiptReview`)는 `px-1.5`
 * 로 좁게 쓰는 게 맞다. 좌우 여백이 **있는지**만 본다.
 */
const SRC = join(process.cwd(), "src");

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

describe("목록 표 머리글 칸", () => {
  it("좌우 여백을 갖고 굵기를 더하지 않는다", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = toRelPosix(file);
      if (rel.includes("__tests__")) continue;
      const text = readFileSync(file, "utf8");
      for (const block of text.match(/<thead[\s\S]*?<\/thead>/g) ?? []) {
        // 목록 표만 본다 — 머리글 tr 의 표준 스타일이 그 표식이다.
        if (!/uppercase tracking-\[0\.0\d+em\]/.test(block)) continue;
        for (const cell of block.match(/<th[^>]*className="[^"]*"/g) ?? []) {
          const cls = /className="([^"]*)"/.exec(cell)?.[1] ?? "";
          // 한쪽만 있으면(pr-3) 왼쪽이 비어 본문과 세로가 어긋난다.
          const spaced = /\bpx-[\d.]+/.test(cls);
          const bold = /font-(medium|bold|semibold)/.test(cls);
          if (spaced && !bold) continue;
          const line = text.slice(0, text.indexOf(cell)).split(/\r?\n/).length;
          offenders.push(`${rel}:${line} — ${cls}`);
        }
      }
    }
    expect(
      offenders,
      `목록 표 머리글은 좌우 여백(px-*)을 두고 굵기를 빼세요:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
