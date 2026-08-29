import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentCard } from "../AgentCard";

const base = {
  agent: "assistant-runner",
  role: "어시스턴트",
  team: "조율",
  detail: "어시스턴트",
  llm: true,
  planned: false,
  pollerId: "assistant",
};

/**
 * 관제탑 카드 — '지금 이 에이전트가 살아 있나 / 얼마나 도나'를 한 장에.
 */
describe("AgentCard", () => {
  it("에이전트 이름과 맡은 일을 보여준다", () => {
    render(<AgentCard member={base} verdict="working" usage={{ daily: [0], today: 0 }} />);
    expect(screen.getByText("assistant-runner")).toBeInTheDocument();
    expect(screen.getByText("어시스턴트")).toBeInTheDocument();
  });

  it("회사 PC 에서 도는 에이전트는 생사를 보여준다", () => {
    render(
      <AgentCard member={base} verdict="stopped" usage={{ daily: [1], today: 1 }} />,
    );
    expect(screen.getByText("멈춤")).toBeInTheDocument();
  });

  it("판정이 없으면 생사를 말하지 않는다 — 모르면서 정상이라 하지 않는다", () => {
    render(
      <AgentCard
        member={{ ...base, pollerId: undefined }}
        verdict={undefined}
        usage={{ daily: [1], today: 1 }}
      />,
    );
    expect(screen.queryByText("멈춤")).not.toBeInTheDocument();
    expect(screen.queryByText("처리 중")).not.toBeInTheDocument();
  });

  it("오늘 건수를 보여준다", () => {
    render(
      <AgentCard
        member={base}
        verdict="working"
        usage={{ daily: [0, 3, 12], today: 12 }}
      />,
    );
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });

  /**
   * 실행 기록이 없는 자리(상시 동작·예정)를 0 으로 그리면 '안 돌았다'로 읽힌다.
   * 안 돈 것과 셀 수 없는 것은 다르다.
   */
  it("셀 수 없으면 0 이 아니라 그렇다고 말한다", () => {
    render(
      <AgentCard
        member={{ ...base, pollerId: undefined }}
        verdict={undefined}
        usage={{ daily: null, today: null }}
      />,
    );
    expect(screen.queryByText("0건")).not.toBeInTheDocument();
    expect(screen.getByText(/기록 없음/)).toBeInTheDocument();
  });

  it("예정인 자리는 그렇다고 말한다", () => {
    render(
      <AgentCard
        member={{ ...base, planned: true, pollerId: undefined }}
        verdict={undefined}
        usage={{ daily: null, today: null }}
      />,
    );
    expect(screen.getByText("예정")).toBeInTheDocument();
  });

  it("LLM 이 판단하는 자리를 표시한다", () => {
    render(<AgentCard member={base} verdict="working" usage={{ daily: [1], today: 1 }} />);
    expect(screen.getByTitle(/LLM/)).toBeInTheDocument();
  });
});
