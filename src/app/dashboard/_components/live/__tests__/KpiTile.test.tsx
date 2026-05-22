import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiTile } from "../KpiTile";

function mockReducedMotion(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (q: string) => ({
      matches: q.includes("reduce") && reduce,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      media: q,
      dispatchEvent: () => false,
    }),
  });
}

describe("KpiTile", () => {
  beforeEach(() => {
    mockReducedMotion(false);
  });

  it("라벨/숫자/countSub 렌더", () => {
    render(<KpiTile label="서비스" count={5} countSub="내 담당 · 오픈 예정" href="/dashboard/services" />);
    expect(screen.getByText("서비스")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/내 담당 · 오픈 예정/)).toBeInTheDocument();
  });
  it("count=null이면 — 표시", () => {
    render(<KpiTile label="미수채권" count={null} countSub="—" href="/dashboard/receivables" />);
    expect(screen.getByText("—", { selector: "[data-kpi-number]" })).toBeInTheDocument();
  });
  it("href가 있는 링크로 감싸짐", () => {
    render(<KpiTile label="서비스" count={5} countSub="x" href="/dashboard/services" />);
    const link = screen.getByRole("link", { name: /서비스/ });
    expect(link).toHaveAttribute("href", "/dashboard/services");
  });
});
