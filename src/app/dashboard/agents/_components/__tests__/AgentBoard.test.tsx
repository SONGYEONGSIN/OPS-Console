import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { activitySpy, activity } = vi.hoisted(() => ({
  activitySpy: vi.fn(),
  activity: {
    value: [
      { at: "2026-08-30T10:00:00+09:00", outcome: "ok", note: null },
      { at: "2026-08-30T09:00:00+09:00", outcome: "fail", note: "Graph 500" },
    ] as { at: string; outcome: string; note: string | null }[],
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/features/agent-org/activity", () => ({
  getAgentActivity: (agent: string) => {
    activitySpy(agent);
    return Promise.resolve(activity.value);
  },
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
    driver: "요청 대기",
  },
  {
    agent: "ratio-poller",
    role: "경쟁률",
    team: "관측팀",
    detail: "경쟁률 점검",
    llm: false,
    planned: false,
    pollerId: "ratio-audit",
    driver: "요청 대기",
  },
  {
    agent: "trace-recorder",
    role: "추적",
    team: "관측팀",
    detail: "",
    llm: false,
    planned: true,
    driver: "",
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
  it("지표는 각자 카드다 — 붙여 놓지 않는다", () => {
    render1();
    expect(screen.getByTestId("kpi-stopped")).toHaveClass("border");
  });

  it("에이전트 수가 맨 앞이다", () => {
    render1();
    const labels = [...document.querySelectorAll("[data-kpi]")].map((el) =>
      el.getAttribute("data-kpi"),
    );
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
      screen.getByRole("row", { name: /assistant-runner/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("row", { name: /ratio-poller/ }),
    ).toBeInTheDocument();
  });

  it("한 줄에서 맡은 일과 오늘 건수를 읽는다", () => {
    render1();
    const row = screen.getByRole("row", { name: /assistant-runner/ });
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
      screen.getByRole("row", { name: /ratio-poller/ }),
    ).toHaveTextContent("기록 없음");
  });

  it("제목은 다른 목록 메뉴와 같은 규격이다 — text-xl font-bold", () => {
    render1();
    const h = screen.getByRole("heading", { name: "에이전트" });
    expect(h).toHaveClass("text-xl");
    expect(h).toHaveClass("font-bold");
  });

  it("건수는 제목 옆에 vermilion 으로 — ListPattern 과 같다", () => {
    render1();
    expect(screen.getByText("3건")).toHaveClass("text-vermilion");
  });

  it("표 머리글이 다른 표와 같은 규격이다 — uppercase · py-2 · px-3", () => {
    render1();
    const head = screen.getByTestId("agent-thead");
    expect(head).toHaveClass("uppercase");
    // 진짜 표가 된 뒤로 패딩은 <tr> 이 아니라 <th> 가 진다 — 다른 표와 같다.
    const th = screen.getAllByRole("columnheader")[0];
    expect(th).toHaveClass("py-2");
    expect(th).toHaveClass("px-3");
  });

  /**
   * 열이 일곱이라 좁은 화면에서 고정폭들이 눌려 깨졌다. 다른 목록 표와 같이
   * **표만 가로 스크롤**한다 — 페이지 전체가 밀리면 안 된다.
   */
  it("좁은 화면에서는 표만 가로로 스크롤한다", () => {
    render1();
    const scroller = screen.getByTestId("agent-scroll");
    expect(scroller).toHaveClass("overflow-x-auto");
    // 최소 폭이 없으면 스크롤이 안 생기고 그냥 찌그러진다. 표에 건다.
    expect(screen.getByRole("table").className).toMatch(/min-w-\[/);
  });

  it("표에 머리글이 있다 — 숫자만 있고 무엇인지 없으면 못 읽는다", () => {
    render1();
    const head = screen.getByTestId("agent-thead");
    for (const label of ["팀", "맡은 일", "구동", "오늘", "마지막"]) {
      expect(head).toHaveTextContent(label);
    }
  });

  it("팀 · 맡은 일 · 구동 순으로 읽는다", () => {
    render1();
    const cols = [
      ...screen.getByTestId("agent-thead").querySelectorAll("[data-col]"),
    ].map((el) => el.getAttribute("data-col"));
    expect(cols.slice(0, 3)).toEqual(["팀", "맡은 일", "구동"]);
  });

  it("무엇이 부르는지 적는다 — 배지 없음을 이상으로 읽지 않게", () => {
    render1();
    expect(
      screen.getByRole("row", { name: /assistant-runner/ }),
    ).toHaveTextContent("요청 대기");
  });

  it("팀 필터는 운영부 뉴스와 같은 모양이다 — 우측 정렬 + 건수 괄호", () => {
    render1();
    const group = screen.getByRole("group", { name: "팀 필터" });
    expect(group).toHaveClass("ml-auto");
    expect(group).toHaveTextContent("전체 (3)");
    expect(group).toHaveTextContent("관측팀 (2)");
  });

  it("팀은 필터로만 남는다", () => {
    render1("관측팀");
    expect(
      screen.getByRole("row", { name: /ratio-poller/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("row", { name: /assistant-runner/ }),
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
    fireEvent.click(screen.getByRole("row", { name: /assistant-runner/ }));
    const panel = screen.getByTestId("agent-inspector");
    expect(panel).toHaveTextContent("assistant-runner");
  });

  it("회사 PC 에서 도는 에이전트는 연결 상태를 보여준다", () => {
    render1();
    fireEvent.click(screen.getByRole("row", { name: /ratio-poller/ }));
    expect(screen.getByTestId("agent-inspector")).toHaveTextContent("멈춤");
  });

  it("회사 PC 와 무관한 에이전트에는 연결을 말하지 않는다", () => {
    render1();
    fireEvent.click(screen.getByRole("row", { name: /trace-recorder/ }));
    expect(screen.getByTestId("agent-inspector")).not.toHaveTextContent("연결");
  });

  it("사용량을 일별로 보여준다", () => {
    render1();
    fireEvent.click(screen.getByRole("row", { name: /assistant-runner/ }));
    expect(screen.getByTestId("agent-inspector")).toHaveTextContent("최근 3일");
  });

  it("다른 행을 누르면 그쪽으로 바뀐다 — 닫았다 열 필요가 없다", () => {
    render1();
    fireEvent.click(screen.getByRole("row", { name: /assistant-runner/ }));
    fireEvent.click(screen.getByRole("row", { name: /ratio-poller/ }));
    expect(screen.getByTestId("agent-inspector")).toHaveTextContent(
      "ratio-poller",
    );
  });
});

/**
 * 요청의 2번 — "에이전트별 실시간 작동 로그". 지금까지 인스펙터엔 연결·사용량만
 * 있었고 "무엇을 언제 했나"가 없었다.
 */
describe("AgentBoard — 활동 로그", () => {
  it("행을 열면 그 에이전트의 활동을 가져온다", async () => {
    activitySpy.mockClear();
    render1();
    fireEvent.click(screen.getByRole("row", { name: /assistant-runner/ }));
    await waitFor(() =>
      expect(activitySpy).toHaveBeenCalledWith("assistant-runner"),
    );
  });

  it("실패는 사유를 그대로 보여준다 — 요약하면 왜 안 됐는지 모른다", async () => {
    render1();
    fireEvent.click(screen.getByRole("row", { name: /assistant-runner/ }));
    expect(await screen.findByText(/Graph 500/)).toBeInTheDocument();
  });

  it("활동이 없으면 없다고 말한다 — 빈 칸만 두지 않는다", async () => {
    activity.value = [];
    render1();
    fireEvent.click(screen.getByRole("row", { name: /assistant-runner/ }));
    expect(await screen.findByText(/최근 활동이 없습니다/)).toBeInTheDocument();
    activity.value = [
      { at: "2026-08-30T10:00:00+09:00", outcome: "ok", note: null },
      { at: "2026-08-30T09:00:00+09:00", outcome: "fail", note: "Graph 500" },
    ];
  });
});

/**
 * 인스펙터 시인성(2026-09-07 지적).
 *
 * - 최근 활동·사용량 시각이 화면마다 달랐다 — 자동화 실행 로그와 한 형식으로 맞춘다
 * - `최근 7일 · 0 · 0 · 1 · …` 이 무엇인지 알 수 없었다 — 날짜·단위를 붙인다
 * - 막대가 글자라 인스펙터 너비를 못 채웠다
 */
describe("AgentBoard 인스펙터 — 시인성", () => {
  const src = readFileSync(
    join(process.cwd(), "src/app/dashboard/agents/_components/AgentBoard.tsx"),
    "utf8",
  );

  it("실행 이력 시각은 공통 형식을 쓴다", () => {
    expect(src).toContain("kstDateTime");
  });

  it("최근 활동에 시:분만 찍던 포맷터를 안 쓴다", () => {
    expect(src).not.toMatch(/timeFmt\.format\(new Date\(a\.at\)\)/);
  });

  it("사용량은 차트 컴포넌트를 쓴다 — 글자 막대가 아니다", () => {
    expect(src).toContain("UsageChart");
  });

  it("인스펙터에서 값을 점으로 늘어놓지 않는다", () => {
    expect(src).not.toContain('daily!.join(" · ")');
  });
});

describe("AgentBoard — 읽기 편한 세부", () => {
  const src = readFileSync(
    join(process.cwd(), "src/app/dashboard/agents/_components/AgentBoard.tsx"),
    "utf8",
  );

  it("실패 사유를 글자 단위로 자르지 않는다 — 한글이 아무 데서나 끊긴다", () => {
    expect(src).not.toContain("break-all");
    expect(src).toContain("break-words");
  });

  it("마지막 실행 칸도 자릿수를 맞춘다 — 세로로 늘어서는 값이다", () => {
    // 표 칸을 직접 본다 — 머리글에서 세면 사이 거리가 늘 때마다 깨진다.
    const cell = /<td className="([^"]*)">\s*\{lastLabel\(/.exec(src);
    expect(cell, "마지막 실행 칸을 못 찾았습니다").toBeTruthy();
    expect(cell![1]).toContain("tabular-nums");
  });
});
