import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { AgentBoard } from "../AgentBoard";
import type { AgentCardMember } from "../AgentCard";

const members: AgentCardMember[] = [
  {
    agent: "assistant-runner",
    role: "어시스턴트",
    team: "조율",
    detail: "어시스턴트",
    llm: true,
    planned: false,
    pollerId: "assistant",
  },
  {
    agent: "ratio-poller",
    role: "경쟁률",
    team: "관측팀",
    detail: "경쟁률 점검",
    llm: false,
    planned: false,
    pollerId: "ratio-audit",
  },
  {
    agent: "trace-recorder",
    role: "추적",
    team: "관측팀",
    detail: "",
    llm: false,
    planned: true,
  },
];

const usage = {
  "assistant-runner": { daily: [1, 2, 12], today: 12 },
  "ratio-poller": { daily: [0, 1, 1], today: 1 },
  "trace-recorder": { daily: null, today: null },
};

const render1 = (team?: string) =>
  render(
    <AgentBoard
      members={members}
      verdicts={{ assistant: "working", "ratio-audit": "stopped" }}
      usage={usage}
      team={team}
    />,
  );

describe("AgentBoard", () => {
  it("맨 위에 전체 상태를 요약한다 — 한 장으로 지금을 알아야 한다", () => {
    render1();
    expect(screen.getByText("도는 중")).toBeInTheDocument();
    expect(screen.getByText("오늘 실행")).toBeInTheDocument();
    // '멈춤'은 KPI 라벨과 카드 배지 양쪽에 나온다 — KPI 쪽을 짚는다.
    expect(screen.getByTestId("kpi-stopped")).toHaveTextContent("멈춤");
  });

  it("오늘 실행은 셀 수 있는 것만 더한다", () => {
    render1();
    // 12 + 1 = 13. trace-recorder 는 기록이 없어 0으로 세지 않는다.
    expect(screen.getByText("13")).toBeInTheDocument();
  });

  it("에이전트를 카드로 늘어놓는다", () => {
    render1();
    expect(screen.getByText("assistant-runner")).toBeInTheDocument();
    expect(screen.getByText("ratio-poller")).toBeInTheDocument();
  });

  it("팀은 필터로만 남는다 — 묶음이 아니라 거르는 수단이다", () => {
    render1("관측팀");
    expect(screen.getByText("ratio-poller")).toBeInTheDocument();
    expect(screen.queryByText("assistant-runner")).not.toBeInTheDocument();
  });

  it("팀 칩이 전체를 포함해 나온다", () => {
    render1();
    expect(screen.getByRole("link", { name: "전체" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /관측팀/ })).toBeInTheDocument();
  });

  it("멈춘 게 있으면 숫자로 드러낸다", () => {
    render1();
    const stopped = screen.getByTestId("kpi-stopped");
    expect(stopped).toHaveTextContent("1");
  });
});
