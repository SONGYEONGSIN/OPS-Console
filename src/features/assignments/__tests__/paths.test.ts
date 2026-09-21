import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { ASSIGNMENTS_PATH, WORK_ASSIGNMENT_PATH } from "../paths";

/**
 * 라우트가 움직이면 **숫자만 낡는다** — 에러가 안 난다.
 *
 * #1205 가 배분현황·제안을 `/dashboard/work-assignment` 로 옮겼는데 server action
 * 넷은 옛 주소만 다시 그렸다. 승인한 배치가 화면에서 계속 pending 으로 보이고,
 * 배정을 고쳐도 배분현황의 대학 수가 예전 값이다. 둘 다 조용하다.
 *
 * 그래서 이 파일은 둘을 붙들어 둔다 — 상수가 **진짜 라우트**를 가리키는지, 그리고
 * 원장을 쓰는 곳이 **두 화면을 짝으로** 다시 그리는지.
 */

/** 주석을 지우고 원문만 본다 — 왜 그러는지 적은 설명이 정규식에 잡힌다. */
const code = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

/** 원장(`assignments`)에 쓰는 server action 이 있는 파일. */
const LEDGER_ACTION_FILES = [
  "src/features/assignments/actions.ts",
  "src/features/assignments/proposal/actions.ts",
];

describe("배정 화면 주소", () => {
  it("상수는 실제 라우트를 가리킨다 — 오타는 조용히 아무것도 안 한다", () => {
    expect(existsSync(`src/app${ASSIGNMENTS_PATH}/page.tsx`)).toBe(true);
    expect(existsSync(`src/app${WORK_ASSIGNMENT_PATH}/page.tsx`)).toBe(true);
  });

  it.each(LEDGER_ACTION_FILES)(
    "%s — 총괄장을 다시 그리는 자리마다 업무배정도 바로 뒤따른다",
    (file) => {
      /*
       * **짝으로 붙어 있는지**를 본다. 파일 안 개수만 세면 업무배정만 다시 그리는
       * 자리(판정 요청 적재 — 원장을 안 바꾼다)가 끼어 수가 맞아 버리고, 정작
       * 짝 하나가 빠져도 초록이 된다.
       */
      const src = code(file);
      const legacy = new RegExp(
        `revalidatePath\\(\\s*"${ASSIGNMENTS_PATH}"\\s*\\)`,
        "g",
      );
      const paired = new RegExp(
        `revalidatePath\\(\\s*"${ASSIGNMENTS_PATH}"\\s*\\)\\s*;\\s*revalidatePath\\(\\s*WORK_ASSIGNMENT_PATH\\s*\\)`,
        "g",
      );

      const found = [...src.matchAll(legacy)].length;
      expect(found).toBeGreaterThan(0);
      expect([...src.matchAll(paired)].length).toBe(found);
    },
  );
});
