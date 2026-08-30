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
