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
    agent: "mail-ingestor",
    role: "메일",
    team: "수집팀",
    detail: "메일함 AI 초안 생성",
    llm: true,
    planned: false,
    driver: "주기 실행",
  },
];

const usage = {
  "mail-ingestor": { daily: [10, 20, 144], today: 144, lastAt: null },
};

const render1 = () =>
  render(<AgentBoard members={members} verdicts={{}} usage={usage} />);

/**
 * 막대는 **그 에이전트 자기 7일 최대값 기준**으로 정규화한다(`n / max`).
 * 그래서 144건짜리와 1건짜리의 가장 높은 막대가 같은 높이로 보인다 —
 * 서로 다른 에이전트끼리 높이를 비교하면 틀린다.
 *
 * 머리글이 `7일` 뿐이면 이걸 알 방법이 없다.
 */
describe("AgentBoard — 7일 추이 읽는 법", () => {
  it("머리글이 무엇을 그리는지 말한다", () => {
    render1();
    const th = screen.getByRole("columnheader", { name: /7일/ });
    expect(th).toHaveTextContent("추이");
  });

  it("행끼리 비교하면 안 된다는 걸 머리글이 알린다", () => {
    render1();
    expect(
      screen.getByRole("columnheader", { name: /7일/ }).getAttribute("title"),
    ).toMatch(/최대/);
  });

  /** 인스펙터에는 원래 값이 있으니, 높이가 상대값이라는 것만 덧붙이면 된다. */
  it("인스펙터가 상대 높이임을 밝힌다", () => {
    render1();
    fireEvent.click(screen.getByRole("row", { name: /mail-ingestor/ }));
    expect(screen.getByText(/다른 에이전트와 높이를 견주지/)).toBeInTheDocument();
  });
});
