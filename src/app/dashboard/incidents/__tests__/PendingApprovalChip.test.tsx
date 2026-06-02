import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockUsePathname, mockUseSearchParams } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(() => "/dashboard/incidents"),
  mockUseSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
  useSearchParams: mockUseSearchParams,
}));

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

import { PendingApprovalChip } from "../PendingApprovalChip";

describe("PendingApprovalChip", () => {
  it("href 에 report=pending 추가, page 제거, 기존 param 보존", () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("year=2027&page=3"),
    );
    render(<PendingApprovalChip />);
    const link = screen.getByLabelText("경위서 승인 대기");
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("report=pending");
    expect(href).toContain("year=2027");
    expect(href).not.toContain("page=3");
  });

  it("report=pending 시 active (aria-pressed=true)", () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("report=pending"),
    );
    render(<PendingApprovalChip />);
    expect(screen.getByLabelText("경위서 승인 대기")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("report 없으면 inactive (aria-pressed=false)", () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    render(<PendingApprovalChip />);
    expect(screen.getByLabelText("경위서 승인 대기")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
