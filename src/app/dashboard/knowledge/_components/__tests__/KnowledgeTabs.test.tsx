import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { KnowledgeTabs } from "../KnowledgeTabs";

/**
 * 지식망 한 화면에 문서·초안·검토·빈틈이 세로로 쌓여 있었다. 문서를 보러 온
 * 사람에게 초안 폼이 먼저 보이는 순서였다.
 */
describe("KnowledgeTabs", () => {
  it("네 칸을 탭으로 나눈다", () => {
    render(<KnowledgeTabs active="docs" reviewCount={0} gapCount={0} />);
    for (const name of ["문서", "초안 만들기", "검토 대기", "빈틈"]) {
      expect(screen.getByRole("tab", { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it("지금 칸을 표시한다", () => {
    render(<KnowledgeTabs active="draft" reviewCount={0} gapCount={0} />);
    expect(screen.getByRole("tab", { name: "초안 만들기" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("기다리는 건수를 탭에 붙인다 — 안 붙으면 방치돼도 모른다", () => {
    render(<KnowledgeTabs active="docs" reviewCount={1} gapCount={3} />);
    expect(
      screen.getByRole("tab", { name: /검토 대기\s*1/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /빈틈\s*3/ })).toBeInTheDocument();
  });

  it("기다리는 게 없으면 숫자를 안 붙인다 — 0이 붙으면 눈만 시끄럽다", () => {
    render(<KnowledgeTabs active="docs" reviewCount={0} gapCount={0} />);
    expect(screen.getByRole("tab", { name: "검토 대기" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "빈틈" })).toBeInTheDocument();
  });

  it("문서 탭은 doc 선택을 안 달고 나간다 — 늘 목록에서 시작한다", () => {
    render(<KnowledgeTabs active="draft" reviewCount={0} gapCount={0} />);
    expect(screen.getByRole("tab", { name: "문서" })).toHaveAttribute(
      "href",
      "/dashboard/knowledge",
    );
    expect(screen.getByRole("tab", { name: "빈틈" })).toHaveAttribute(
      "href",
      "/dashboard/knowledge?tab=gaps",
    );
  });
});
