import { describe, it, expect } from "vitest";
import { orgGoalMembers } from "../org-goal-members";

const OPS = [
  { name: "김운영", email: "a@x.com", team: "운영1팀", department: "운영부" },
  { name: "이운영", email: "b@x.com", team: "운영1팀", department: "운영부" },
  { name: "박이팀", email: "c@x.com", team: "운영2팀", department: "운영부" },
  { name: "최기획", email: "d@x.com", team: "기획팀", department: "본부장 직속" },
  { name: "테스트1", email: "t@x.com", team: "운영1팀", department: "운영부" },
];

/**
 * 조직 목표의 실적은 **소속원의 실적을 합산**해서 낸다. 누구를 합산하느냐가
 * 틀리면 달성률이 조용히 틀린다 — 아무도 눈치채지 못한다.
 */
describe("orgGoalMembers", () => {
  it("팀 목표는 그 팀 사람만 합산한다", () => {
    expect(orgGoalMembers("team", "운영1팀", OPS)).toEqual([
      "a@x.com",
      "b@x.com",
    ]);
  });

  /**
   * 기획팀은 운영부가 아니라 본부장 직속이다. 본부 목표에 끌어오면
   * 남의 조직 실적이 우리 달성률에 섞인다.
   */
  it("본부 목표는 그 부서 사람만 합산한다 — 기획팀은 운영부가 아니다", () => {
    expect(orgGoalMembers("division", "운영부", OPS)).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
    ]);
  });

  /** 테스트 계정의 실적을 팀 성과에 넣으면 목표가 저절로 채워진다. */
  it("테스트 계정은 뺀다", () => {
    expect(orgGoalMembers("team", "운영1팀", OPS)).not.toContain("t@x.com");
  });

  it("없는 조직이면 빈 목록 — 0 명이지 전원이 아니다", () => {
    expect(orgGoalMembers("team", "없는팀", OPS)).toEqual([]);
  });
});
