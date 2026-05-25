import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PeriodSelector } from "../PeriodSelector";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/reports",
  useSearchParams: () => new URLSearchParams("period=this-month"),
}));

describe("PeriodSelector", () => {
  it("5 옵션 라벨 표시 (이번 주/이번 달/지난 달/분기/연간)", () => {
    render(<PeriodSelector />);
    expect(screen.getByText("이번 주")).toBeInTheDocument();
    expect(screen.getByText("이번 달")).toBeInTheDocument();
    expect(screen.getByText("지난 달")).toBeInTheDocument();
    expect(screen.getByText("분기")).toBeInTheDocument();
    expect(screen.getByText("연간")).toBeInTheDocument();
  });

  it("현재 ?period=this-month → '이번 달' aria-current=page", () => {
    render(<PeriodSelector />);
    const active = screen.getByText("이번 달").closest("a");
    expect(active).toHaveAttribute("aria-current", "page");
  });

  it("각 옵션 링크는 /dashboard/reports?period=<value>", () => {
    render(<PeriodSelector />);
    const link = screen.getByText("지난 달").closest("a");
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/reports?period=last-month",
    );
  });
});
