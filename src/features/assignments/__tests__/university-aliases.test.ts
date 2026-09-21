import { describe, it, expect } from "vitest";
import { UNIVERSITY_ALIASES, aliasOfUniversity } from "../university-aliases";

/**
 * 대학명 별칭 — **사람이 확인한 사실만 적는다.**
 *
 * 설계 F1 은 *추측해서* 잇지 말라는 것이다. 여기 줄들은 실측으로 원장에 그 이름이
 * 그 업무종류로 있는 것을 확인한 것이고(2026-09-21, 19/19), 줄마다 왜 그렇게
 * 읽는지가 주석에 있다. 기계가 고른 것이 아니라 사람이 고른 것이다.
 *
 * 표(DB)가 아니라 **커밋된 상수**인 이유: 교명 변경·신규 전형처럼 연 몇 회 바뀌는
 * 값이라 마이그레이션·RLS·관리 화면을 세울 만큼 자주 움직이지 않고, 새 갈림은
 * 배분현황 배너가 알려 준다. 30개를 넘거나 배포 없이 고쳐야 하면 그때 표로 올린다.
 */

describe("aliasOfUniversity", () => {
  it("별칭이 있으면 원장 이름으로 바꾼다", () => {
    expect(aliasOfUniversity("세종대학교 대학원", "PIMS")).toBe("세종대학교");
  });

  it("업무종류가 다르면 그 별칭을 쓰지 않는다", () => {
    /*
     * `동국대학교` 는 발표 자료에서만 (서울)을 가리킨다 — 마감·원서접수에서 같은
     * 이름이 오면 어느 캠퍼스인지 알 수 없으므로 손대지 않는다.
     */
    expect(aliasOfUniversity("동국대학교", "PIMS")).toBe("동국대학교(서울)");
    expect(aliasOfUniversity("동국대학교", "원서접수")).toBeNull();
  });

  it("별칭이 없으면 null 이다 — 모르면 손대지 않는다", () => {
    expect(aliasOfUniversity("서울대학교", "원서접수")).toBeNull();
  });

  it("독학학위제는 평생교육진흥원이다 — 빠진 배정이 아니라 다른 이름이다", () => {
    expect(aliasOfUniversity("독학학위제", "원서접수")).toBe(
      "평생교육진흥원(독학사)",
    );
  });
});

describe("UNIVERSITY_ALIASES 자체 검사", () => {
  const entries = Object.entries(UNIVERSITY_ALIASES);

  it("자기 자신으로 잇는 줄이 없다 — 있으면 아무 일도 안 하면서 있는 척한다", () => {
    const selfMapped = entries.filter(([key, to]) => key.split("|")[0] === to);
    expect(selfMapped).toEqual([]);
  });

  it("사슬이 없다 — 대상이 또 다른 별칭의 출발점이면 순서에 따라 답이 갈린다", () => {
    const chained = entries.filter(([key, to]) => {
      const workKind = key.split("|")[1];
      return `${to}|${workKind}` in UNIVERSITY_ALIASES;
    });
    expect(chained).toEqual([]);
  });

  it("키는 `이름|업무종류` 두 칸이다", () => {
    for (const [key] of entries) {
      expect(key.split("|")).toHaveLength(2);
    }
  });
});
