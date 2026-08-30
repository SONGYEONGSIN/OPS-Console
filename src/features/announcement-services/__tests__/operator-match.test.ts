import { describe, it, expect } from "vitest";
import { matchOperators, normalizeUniv } from "../operator-match";

/**
 * 합격자발표 서비스에는 운영자 컬럼이 없다. 총괄장(대학×서비스 배정)에서 가져온다.
 *
 * **조용히 틀리면 남의 성과가 된다.** 그래서 매칭 규칙을 순수 함수로 못박고,
 * 못 맞춘 건 반드시 목록으로 돌려준다 — 0으로 삼키지 않는다.
 */
describe("normalizeUniv", () => {
  it("공백을 지운다 — 같은 학교가 표기만 다르다", () => {
    expect(normalizeUniv("서울 여자대학교")).toBe(normalizeUniv("서울여자대학교"));
  });

  it("'국립' 접두를 뗀다 — 총괄장은 국립창원대, 발표는 창원대다", () => {
    expect(normalizeUniv("국립창원대학교")).toBe(normalizeUniv("창원대학교"));
  });

  /**
   * 접미사는 **떼지 않는다.** `건국대학교 글로컬`을 `건국대학교`로 맞추면
   * 글로컬 캠퍼스 실적이 본교 담당자 성과가 된다 — 다른 사람의 일이다.
   */
  it("캠퍼스·전형 접미사는 떼지 않는다 — 다른 사람의 일이다", () => {
    expect(normalizeUniv("건국대학교 글로컬")).not.toBe(
      normalizeUniv("건국대학교"),
    );
  });
});

describe("matchOperators", () => {
  const assign = [
    { university: "국립창원대학교", operator: "김운영" },
    { university: "서울여자대학교", operator: "이담당" },
    { university: "빈운영자대학교", operator: "" },
  ];

  it("이름이 맞으면 운영자를 붙인다", () => {
    const r = matchOperators(["창원대학교"], assign);
    expect(r.matched).toEqual([{ university: "창원대학교", operator: "김운영" }]);
    expect(r.unmatched).toEqual([]);
  });

  it("못 맞춘 건 목록으로 돌려준다 — 0으로 삼키지 않는다", () => {
    const r = matchOperators(["없는고등학교"], assign);
    expect(r.matched).toEqual([]);
    expect(r.unmatched).toEqual(["없는고등학교"]);
  });

  /**
   * 총괄장에 학교는 있는데 운영자 칸이 빈 경우가 있다. 빈 이름을 붙이면
   * '배정됨'으로 보이는데 실제로는 담당자가 없다.
   */
  it("운영자가 비어 있으면 미매칭이다 — 빈 이름을 붙이지 않는다", () => {
    const r = matchOperators(["빈운영자대학교"], assign);
    expect(r.matched).toEqual([]);
    expect(r.unmatched).toEqual(["빈운영자대학교"]);
  });

  it("같은 학교가 여러 시트에 있으면 먼저 온 것을 쓴다", () => {
    const r = matchOperators(
      ["서울여자대학교"],
      [
        { university: "서울여자대학교", operator: "먼저" },
        { university: "서울여자대학교", operator: "나중" },
      ],
    );
    expect(r.matched[0].operator).toBe("먼저");
  });

  it("빈 목록이면 빈 결과", () => {
    expect(matchOperators([], assign)).toEqual({ matched: [], unmatched: [] });
  });
});
