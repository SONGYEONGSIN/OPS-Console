import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { PendingProposals } from "../PendingProposals";

/**
 * '빈틈'은 아직 없는 것이고 '검토 대기'는 이미 써놓고 사람을 기다리는 것이다.
 * 성격이 달라 한 칸에 두면 검토할 초안이 빈틈 목록 아래로 밀려 닫혀 보인다.
 */
describe("PendingProposals", () => {
  it("초안을 눌러 열 수 있게 한다 — 안 읽고는 옮길 수 없다", () => {
    render(
      <PendingProposals
        proposals={[
          { path: "제안/취업규칙 요점.md", title: "취업규칙 요점" },
        ]}
      />,
    );
    const link = screen.getByRole("link", { name: "취업규칙 요점" });
    expect(link).toHaveAttribute(
      "href",
      `/dashboard/knowledge?doc=${encodeURIComponent("제안/취업규칙 요점.md")}`,
    );
  });

  it("몇 건인지 말한다", () => {
    render(
      <PendingProposals
        proposals={[
          { path: "제안/a.md", title: "a" },
          { path: "제안/b.md", title: "b" },
        ]}
      />,
    );
    expect(screen.getByText(/2건/)).toBeInTheDocument();
  });

  it("에이전트가 쓴 것이라고 밝힌다 — 사람이 쓴 문서와 같은 무게로 읽으면 안 된다", () => {
    render(<PendingProposals proposals={[{ path: "제안/a.md", title: "a" }]} />);
    expect(screen.getByText(/에이전트가 쓴 것/)).toBeInTheDocument();
  });

  it("없으면 없다고 한다 — 빈 칸만 두지 않는다", () => {
    render(<PendingProposals proposals={[]} />);
    expect(screen.getByText(/기다리는 초안이 없습니다/)).toBeInTheDocument();
  });
});
