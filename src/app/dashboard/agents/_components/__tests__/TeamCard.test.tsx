import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamCard } from "../TeamCard";
import { BADGE_TONE } from "@/app/dashboard/_components/inspector/list-variants/badge-tone";
import type { ResolvedTeam } from "@/features/agent-org/resolve";

const team: ResolvedTeam = {
  id: "judge",
  name: "판단팀",
  leaderName: "성용",
  tagline: "중원에서 각을 읽고 어디로 갈지 정한다",
  traits: ["대조", "의심"],
  members: [
    {
      role: "세팅",
      agent: "ratio-auditor",
      llm: true,
      detail: "경쟁률 세팅 점검",
      planned: false,
    },
    {
      role: "입금",
      agent: "deposit-matcher",
      llm: false,
      detail: "입금 매칭 자동화",
      planned: false,
    },
    {
      role: "추적",
      agent: "trace-recorder",
      llm: false,
      detail: "",
      planned: true,
    },
  ],
};

describe("TeamCard", () => {
  it("팀 이름·팀장·한 줄 설명을 보여준다", () => {
    render(<TeamCard team={team} />);
    expect(screen.getByText("판단팀")).toBeInTheDocument();
    expect(screen.getByText("성용")).toBeInTheDocument();
    expect(
      screen.getByText("중원에서 각을 읽고 어디로 갈지 정한다"),
    ).toBeInTheDocument();
  });

  it("성향 칩을 전부 보여준다", () => {
    render(<TeamCard team={team} />);
    expect(screen.getByText("대조")).toBeInTheDocument();
    expect(screen.getByText("의심")).toBeInTheDocument();
  });

  it("팀원의 역할·이름·설명을 보여준다", () => {
    render(<TeamCard team={team} />);
    expect(screen.getByText("ratio-auditor")).toBeInTheDocument();
    expect(screen.getByText("경쟁률 세팅 점검")).toBeInTheDocument();
  });

  it("LLM으로 판단하는 자리에만 ✦를 붙인다", () => {
    render(<TeamCard team={team} />);
    const marks = screen.getAllByTitle("LLM으로 판단합니다");
    expect(marks).toHaveLength(1);
  });

  it("미구현 자리에만 예정 배지를 붙이고 공통 규칙 색을 쓴다", () => {
    render(<TeamCard team={team} />);
    const badges = screen.getAllByText("예정");
    expect(badges).toHaveLength(1);
    // '준비 중'은 '중'으로 끝나 규칙이 진행(빨강)으로 판정한다. '예정'이라야 대기(회색)다.
    expect(badges[0]).toHaveClass(...BADGE_TONE.idle.split(" "));
  });

  it("팀원이 없으면 직접 수행이라고 말한다", () => {
    render(<TeamCard team={{ ...team, members: [] }} />);
    expect(screen.getByText("직접 수행")).toBeInTheDocument();
  });
});
