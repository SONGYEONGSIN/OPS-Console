import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { WORKBOOKS } from "../registry";

/**
 * 등록부에 있는 대장은 **화면 어딘가에 버튼이 있어야** 한다.
 *
 * 엔트리만 추가하고 버튼을 안 붙이면 아무도 그 대장을 못 연다. 키를 오타 내도
 * 마찬가지다 — 둘 다 조용히 지나가므로 여기서 잡는다.
 *
 * 동시에 **페이지가 URL 을 직접 조회하지 않는지**도 본다. 그게 이 작업이
 * 없애려는 함정이다(조회 실패 → 버튼이 사라짐 → '기능이 없는 것'과 구분 불가).
 */
const SRC = join(process.cwd(), "src", "app", "dashboard");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__" || name === "workbook") continue;
      out.push(...walk(p));
    } else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = walk(SRC);
const rel = (p: string) => relative(process.cwd(), p).split(sep).join("/");

describe("워크북 버튼이 화면에 있다", () => {
  for (const key of Object.keys(WORKBOOKS)) {
    /**
     * "정확히 하나"가 아니라 "적어도 하나"다 — 우편물은 정상 화면과 **못 읽었을
     * 때 화면** 두 곳에 같은 버튼이 있어야 한다. 대장을 못 읽은 순간이 바로
     * 원본을 열어 봐야 할 때다.
     */
    it(`${key} 버튼이 화면에 있다`, () => {
      const hits = FILES.filter((f) =>
        readFileSync(f, "utf8").includes(`/dashboard/workbook/${key}`),
      ).map(rel);
      expect(hits.length, `${key} 를 가리키는 파일이 없습니다`).toBeGreaterThan(0);
    });
  }

  /**
   * 예전 방식의 흔적 — 화면이 webUrl 을 미리 조회해 들고 있으면, 조회 실패가
   * 다시 버튼을 지운다. 그 함수들은 이 작업에서 삭제된다.
   */
  it("화면이 워크북 URL 을 미리 조회하지 않는다", () => {
    const banned = [
      "getAssignmentsWorkbookUrl",
      "getContractsWorkbookUrl",
      "getReceivablesWorkbookLinks",
      "getPostalWorkbookLinks",
      "getGongmunLedgerUrl",
    ];
    const offenders: string[] = [];
    for (const f of FILES) {
      const text = readFileSync(f, "utf8");
      for (const fn of banned) {
        if (text.includes(fn)) offenders.push(`${rel(f)} — ${fn}`);
      }
    }
    expect(
      offenders,
      `화면은 /dashboard/workbook/<key> 로 보내기만 하세요:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
