import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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
    detail: "어시스턴트 폴러",
    llm: true,
    planned: false,
    pollerId: "assistant",
    driver: "요청 대기",
  },
  {
    agent: "mail-ingestor",
    role: "메일",
    team: "수집팀",
    detail: "메일함 AI 초안 생성",
    llm: true,
    planned: false,
    driver: "주기 실행",
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
  "mail-ingestor": { daily: [0, 1, 1], today: 1, lastAt: null },
  "closing-scraper": { daily: [0, 0, 1], today: 1, lastAt: null },
};

const cost = {
  "assistant-runner": {
    inputTokens: 12400,
    outputTokens: 3120,
    cacheReadTokens: 88000,
    costUsd: 0.43,
    model: "claude-opus-5",
    runs: 9,
  },
  "mail-ingestor": null,
};

const render1 = () =>
  render(
    <AgentBoard members={members} verdicts={{}} usage={usage} cost={cost} />,
  );

/**
 * "이 에이전트가 얼마나 쓰는가" — 지금 토큰을 남기는 건 어시스턴트 한 곳뿐이고,
 * LLM 을 쓰는 나머지 5개는 `claude -p` 라 usage 를 못 받는다. 비 LLM 22개는
 * 비용 개념 자체가 없다.
 *
 * 셋을 같은 `—` 로 그리면 **안 쓰는 것과 못 세는 것이 같아 보인다.**
 */
describe("AgentBoard — 토큰·비용", () => {
  it("목록에 비용을 보여준다", () => {
    render1();
    const row = screen.getByRole("row", { name: /assistant-runner/ });
    expect(row).toHaveTextContent("$0.43");
  });

  /** LLM 인데 값이 없는 건 '아직 안 남는다'다 — 빈칸으로 두면 공짜로 보인다. */
  it("LLM 인데 아직 안 남는 곳은 대시로 둔다", () => {
    render1();
    expect(screen.getByRole("row", { name: /mail-ingestor/ })).toHaveTextContent(
      "—",
    );
  });

  /** 비 LLM 은 비용 개념이 없다. 대시를 채우면 그게 노이즈다. */
  it("비 LLM 은 비용 칸을 비운다", () => {
    render1();
    const cells = screen
      .getByRole("row", { name: /closing-scraper/ })
      .querySelectorAll("td");
    expect(cells[cells.length - 1].textContent).toBe("");
  });

  it("인스펙터가 토큰을 갈라 보여준다 — 캐시가 비용을 좌우한다", () => {
    render1();
    fireEvent.click(screen.getByRole("row", { name: /assistant-runner/ }));
    const ins = screen.getByTestId("agent-inspector");
    expect(ins).toHaveTextContent("12,400");
    expect(ins).toHaveTextContent("3,120");
    expect(ins).toHaveTextContent("88,000");
    expect(ins).toHaveTextContent("claude-opus-5");
  });

  /**
   * 값이 없는 이유가 두 가지다. 한 문구로 뭉치면 **조치가 달라지는데 같은 말을
   * 하게 된다** — 한쪽은 회사 PC 를 갱신하면 되고, 다른 쪽은 스크립트를 고쳐야 한다.
   *
   * cost 맵에 키가 있으면(null) 수집 경로는 있는 것이고, 키가 없으면(undefined)
   * 애초에 남길 자리가 없는 것이다.
   */
  it("수집 경로는 있는데 값이 없으면 '아직'이라고 한다", () => {
    render1();
    fireEvent.click(screen.getByRole("row", { name: /mail-ingestor/ }));
    expect(screen.getByText(/아직 안 쌓였습니다/)).toBeInTheDocument();
  });

  it("수집 경로가 없으면 그 이유를 적는다 — 고칠 곳이 다르다", () => {
    render(
      <AgentBoard
        members={members}
        verdicts={{}}
        usage={usage}
        cost={{ "assistant-runner": cost["assistant-runner"] }}
      />,
    );
    fireEvent.click(screen.getByRole("row", { name: /mail-ingestor/ }));
    expect(screen.getByText(/사용량을 돌려주지 않습니다/)).toBeInTheDocument();
  });

  it("비 LLM 에는 토큰 이야기를 아예 안 한다", () => {
    render1();
    fireEvent.click(screen.getByRole("row", { name: /closing-scraper/ }));
    expect(screen.queryByText(/토큰/)).not.toBeInTheDocument();
  });
});

/** 인스펙터는 다른 메뉴와 같은 부품을 쓴다 — 여기만 자체 Section 이었다. */
describe("AgentBoard — 표준 인스펙터", () => {
  it("제목이 표준 규격이다 — text-xs · tracking-[0.12em]", () => {
    render1();
    fireEvent.click(screen.getByRole("row", { name: /assistant-runner/ }));
    const h = screen.getByRole("heading", { name: "최근 활동" });
    expect(h.className).toContain("text-xs");
    expect(h.className).toContain("font-medium");
    expect(h.className).toContain("tracking-[0.12em]");
  });
});
