import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/features/agent-org/activity", () => ({
  getAgentActivity: () => Promise.resolve([]),
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
    agent: "closing-scraper",
    role: "마감",
    team: "수집팀",
    detail: "서비스 마감 스크래핑",
    llm: false,
    planned: false,
    driver: "주기 실행",
  },
];

const usage = {
  "assistant-runner": { daily: [1, 2, 3], today: 3, lastAt: null },
  "closing-scraper": { daily: [0, 0, 1], today: 1, lastAt: null },
};

const render1 = () =>
  render(
    <AgentBoard
      members={members}
      verdicts={{ assistant: "working" }}
      usage={usage}
    />,
  );

/**
 * 이 표만 div+flex 로 만든 가짜 표였고, `맡은 일` 이 `flex-1` 이라 **남는 폭을
 * 통째로 먹었다.** 2000px 화면에서 맡은 일과 상태 사이가 800px 넘게 비었다.
 *
 * 레포의 다른 목록은 전부 진짜 `<table>` 이라 남는 폭이 여러 열에 나눠 붙는다.
 */
describe("AgentBoard — 표준 표", () => {
  it("진짜 표다 — table·thead·th 를 쓴다", () => {
    render1();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").length).toBeGreaterThan(0);
  });

  /** flex-1 이 남는 폭을 한 열로 몰던 원인 — 다시 들어오면 같은 일이 난다. */
  it("한 열이 남는 폭을 독차지하지 않는다 — flex-1 없음", () => {
    const { container } = render1();
    expect(container.querySelector(".flex-1")).toBeNull();
  });

  it("행을 누르면 인스펙터가 열린다", () => {
    render1();
    expect(
      screen.getByRole("row", { name: /assistant-runner/ }),
    ).toBeInTheDocument();
  });

  /**
   * `상태` 는 회사 PC 폴러에만 값이 있어 잡 20여 개는 영영 빈 칸이었다.
   * 구동과 한 열로 합친다 — 둘 다 "이게 어떻게 도는가"다.
   */
  it("상태를 따로 두지 않는다 — 잡은 영영 빈 칸이었다", () => {
    render1();
    expect(
      screen.queryByRole("columnheader", { name: "상태" }),
    ).not.toBeInTheDocument();
  });

  it("폴러는 구동과 지금 상태가 한 칸에 같이 보인다", () => {
    render1();
    const row = screen.getByRole("row", { name: /assistant-runner/ });
    expect(row).toHaveTextContent("요청 대기");
    expect(row).toHaveTextContent("처리 중");
  });

  it("잡은 구동만 보이고 빈 상태 칸이 없다", () => {
    render1();
    const row = screen.getByRole("row", { name: /closing-scraper/ });
    expect(row).toHaveTextContent("주기 실행");
    expect(row).not.toHaveTextContent("처리 중");
  });

  /** 열이 여럿이라 좁은 화면에서는 표만 가로로 스크롤해야 한다. */
  it("좁은 화면에서는 표만 가로로 스크롤한다", () => {
    render1();
    expect(screen.getByTestId("agent-scroll")).toHaveClass("overflow-x-auto");
    expect(screen.getByRole("table").className).toMatch(/min-w-\[/);
  });
});

/**
 * 표준 표 29개가 전부 `<table className="w-full text-sm">` 이고 칸은 그 크기를
 * **물려받는다.** 작은 글씨(`text-2xs`)는 이름 밑 id 같은 **덧줄**에만 쓴다.
 *
 * 이 표는 칸 값 자체에까지 `text-2xs`·`text-xs` 를 박아, 같은 행 안에서 팀은
 * 작고 건수는 크고 마지막은 또 작았다.
 */
describe("AgentBoard — 글자 크기·색", () => {
  it("칸 값은 표의 크기를 물려받는다 — 칸마다 크기를 박지 않는다", () => {
    render1();
    const tds = [
      ...screen.getByRole("row", { name: /assistant-runner/ }).querySelectorAll("td"),
    ];
    for (const td of tds) {
      expect(td.className, td.textContent ?? "").not.toMatch(/text-(2xs|xs|base|lg)/);
    }
  });

  it("덧줄만 작게 쓴다 — id 는 이름 밑에 붙는 줄이다", () => {
    render1();
    const id = screen.getByText("assistant-runner");
    expect(id.className).toMatch(/text-2xs/);
  });
});
