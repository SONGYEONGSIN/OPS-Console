import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { AgentBoard } from "../AgentBoard";
import type { AgentRow } from "../agent-row";

const members: AgentRow[] = [
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
  "assistant-runner": {
    daily: [1, 2, 12],
    today: 12,
    lastAt: "2026-08-30T10:00:00+09:00",
  },
  "ratio-poller": { daily: [0, 1, 1], today: 1, lastAt: null },
  "trace-recorder": { daily: null, today: null, lastAt: null },
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

describe("AgentBoard — 요약", () => {
  it("요약은 한 판이다 — 카드 안에 카드면 위계가 없다", () => {
    render1();
    expect(screen.getByTestId("kpi-stopped")).not.toHaveClass("border");
    expect(screen.getByTestId("kpi-panel")).toHaveClass("border");
  });

  it("에이전트 수가 맨 앞이다", () => {
    render1();
    const labels = [
      ...screen.getByTestId("kpi-panel").querySelectorAll("[data-kpi]"),
    ].map((el) => el.getAttribute("data-kpi"));
    expect(labels[0]).toBe("에이전트");
  });

  it("오늘 실행은 셀 수 있는 것만 더한다", () => {
    render1();
    expect(screen.getByText("13")).toBeInTheDocument();
  });
});

describe("AgentBoard — 목록", () => {
  it("에이전트를 행으로 늘어놓는다", () => {
    render1();
    expect(
      screen.getByRole("button", { name: /assistant-runner/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ratio-poller/ }),
    ).toBeInTheDocument();
  });

  it("한 줄에서 맡은 일과 오늘 건수를 읽는다", () => {
    render1();
    const row = screen.getByRole("button", { name: /assistant-runner/ });
    expect(row).toHaveTextContent("어시스턴트");
    expect(row).toHaveTextContent("12");
  });

  /**
   * '오늘 0건'만으로는 어제 돌았는지 한 달째 죽었는지 알 수 없다.
   * 무엇부터 봐야 하는지를 마지막 실행이 정한다.
   */
  it("최근에 돈 적이 없으면 그렇다고 말한다", () => {
    render1();
    expect(
      screen.getByRole("button", { name: /ratio-poller/ }),
    ).toHaveTextContent("기록 없음");
  });

  it("팀은 필터로만 남는다", () => {
    render1("관측팀");
    expect(
      screen.getByRole("button", { name: /ratio-poller/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /assistant-runner/ }),
    ).not.toBeInTheDocument();
  });
});

describe("AgentBoard — 인스펙터", () => {
  it("처음에는 닫혀 있다", () => {
    render1();
    expect(screen.queryByTestId("agent-inspector")).not.toBeInTheDocument();
  });

  it("행을 누르면 그 에이전트가 열린다", () => {
    render1();
    fireEvent.click(screen.getByRole("button", { name: /assistant-runner/ }));
    const panel = screen.getByTestId("agent-inspector");
    expect(panel).toHaveTextContent("assistant-runner");
  });

  it("회사 PC 에서 도는 에이전트는 연결 상태를 보여준다", () => {
    render1();
    fireEvent.click(screen.getByRole("button", { name: /ratio-poller/ }));
    expect(screen.getByTestId("agent-inspector")).toHaveTextContent("멈춤");
  });

  it("회사 PC 와 무관한 에이전트에는 연결을 말하지 않는다", () => {
    render1();
    fireEvent.click(screen.getByRole("button", { name: /trace-recorder/ }));
    expect(screen.getByTestId("agent-inspector")).not.toHaveTextContent("연결");
  });

  it("사용량을 일별로 보여준다", () => {
    render1();
    fireEvent.click(screen.getByRole("button", { name: /assistant-runner/ }));
    expect(screen.getByTestId("agent-inspector")).toHaveTextContent("최근 3일");
  });

  it("다른 행을 누르면 그쪽으로 바뀐다 — 닫았다 열 필요가 없다", () => {
    render1();
    fireEvent.click(screen.getByRole("button", { name: /assistant-runner/ }));
    fireEvent.click(screen.getByRole("button", { name: /ratio-poller/ }));
    expect(screen.getByTestId("agent-inspector")).toHaveTextContent(
      "ratio-poller",
    );
  });
});
