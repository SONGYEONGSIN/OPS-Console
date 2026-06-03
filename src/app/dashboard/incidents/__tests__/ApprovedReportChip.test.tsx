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

import { ApprovedReportChip } from "../ApprovedReportChip";

describe("ApprovedReportChip", () => {
  it("href 에 report=approved 추가, page 제거, 기존 param 보존", () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("year=2027&page=3"),
    );
    render(<ApprovedReportChip />);
    const href =
      screen.getByLabelText("경위서 승인 완료").getAttribute("href") ?? "";
    expect(href).toContain("report=approved");
    expect(href).toContain("year=2027");
    expect(href).not.toContain("page=3");
  });

  it("report=approved 시 active (aria-pressed=true)", () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("report=approved"),
    );
    render(<ApprovedReportChip />);
    expect(screen.getByLabelText("경위서 승인 완료")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("토글 — active 시 href는 report 를 제거(해제 경로)", () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("year=2027&report=approved"),
    );
    render(<ApprovedReportChip />);
    const href =
      screen.getByLabelText("경위서 승인 완료").getAttribute("href") ?? "";
    expect(href).not.toContain("report=approved");
    expect(href).toContain("year=2027");
  });
});
