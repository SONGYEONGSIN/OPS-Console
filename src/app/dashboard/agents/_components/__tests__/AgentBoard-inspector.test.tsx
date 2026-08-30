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
];
const usage = {
  "assistant-runner": { daily: [1, 2, 3], today: 3, lastAt: null },
};

const open1 = () => {
  render(<AgentBoard members={members} verdicts={{}} usage={usage} />);
  fireEvent.click(screen.getByRole("row", { name: /assistant-runner/ }));
  return screen.getByTestId("agent-inspector");
};

/**
 * 다른 메뉴의 인스펙터는 전부 `InspectorChrome` 머리를 쓴다 — 눈썹 문구,
 * 굵은 제목, 아래 굵은 구분선. 여기만 자체 머리라 **제목이 본문 글씨만 하고
 * 구분선이 없어** 어디까지가 머리인지 안 보였다.
 */
describe("AgentBoard — 표준 인스펙터 머리", () => {
  it("눈썹 문구가 있다 — 무엇을 보고 있는지 먼저 말한다", () => {
    expect(open1()).toHaveTextContent("인스펙터");
  });

  it("제목이 표준 크기다 — 본문 글씨만 하면 제목으로 안 읽힌다", () => {
    open1();
    const h = screen.getByRole("heading", { name: "어시스턴트 폴러" });
    expect(h.className).toContain("text-xl");
    expect(h.className).toContain("font-bold");
  });

  it("머리 아래 굵은 구분선이 있다 — 어디까지가 머리인지 보여준다", () => {
    const ins = open1();
    const header = ins.querySelector("header");
    expect(header?.className).toContain("border-b-2");
    expect(header?.className).toContain("border-ink");
  });

  it("id 는 제목 밑 덧줄이다 — 제목 자리를 차지하지 않는다", () => {
    const ins = open1();
    // 표 행에도 같은 id 가 있으므로 인스펙터 안으로 한정한다.
    const id = ins.querySelector("header span");
    expect(id?.className).toContain("font-mono");
    expect(id?.textContent).toBe("assistant-runner");
  });
});

/**
 * 표준 인스펙터는 머리 오른쪽에 **상태 링 뱃지**를 두고, 섹션 사이에 **얇은
 * 구분선**을 둔다. 처음엔 "에이전트에 상태 개념이 없다"고 뺐는데 틀렸다 —
 * 폴러는 처리 중·멈춤이 있고, 잡은 최근에 돌았는지가 있다.
 */
describe("AgentBoard — 표준 인스펙터 뱃지·구분선", () => {
  it("머리에 상태 뱃지가 있다", () => {
    render(
      <AgentBoard
        members={members}
        verdicts={{ assistant: "working" }}
        usage={usage}
      />,
    );
    fireEvent.click(screen.getByRole("row", { name: /assistant-runner/ }));
    const ins = screen.getByTestId("agent-inspector");
    expect(ins.querySelector("header")).toHaveTextContent("처리 중");
  });

  /** 멈춘 폴러는 붉게 — 색이 없으면 목록에서 눈에 안 걸린다. */
  it("멈춘 폴러는 붉은 뱃지다", () => {
    render(
      <AgentBoard
        members={members}
        verdicts={{ assistant: "stopped" }}
        usage={usage}
      />,
    );
    fireEvent.click(screen.getByRole("row", { name: /assistant-runner/ }));
    const badge = screen
      .getByTestId("agent-inspector")
      .querySelector("[data-agent-status]");
    expect(badge?.className).toContain("bg-vermilion");
  });

  it("섹션 사이에 구분선이 있다 — 어디서 끊기는지 보여준다", () => {
    const ins = open1();
    expect(ins.querySelectorAll(".border-t").length).toBeGreaterThan(0);
  });
});

/**
 * 구분선은 **섹션 사이**에만 둔다. 연결 섹션이 없는 잡에서 그 앞 구분선이
 * 그대로 남으면, 머리의 굵은 선 바로 밑에 얇은 선이 겹쳐 두 줄로 보인다.
 */
describe("AgentBoard — 구분선은 섹션 사이에만", () => {
  it("연결이 없는 잡은 머리 밑에 선이 붙지 않는다", () => {
    const job: AgentRow[] = [
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
    render(
      <AgentBoard
        members={job}
        verdicts={{}}
        usage={{ "closing-scraper": { daily: [1], today: 1, lastAt: null } }}
      />,
    );
    fireEvent.click(screen.getByRole("row", { name: /closing-scraper/ }));
    const ins = screen.getByTestId("agent-inspector");
    const header = ins.querySelector("header")!;
    // 머리 바로 다음 형제가 구분선이면 두 줄로 겹친다.
    expect(header.nextElementSibling?.className).not.toMatch(/border-t/);
  });
});
