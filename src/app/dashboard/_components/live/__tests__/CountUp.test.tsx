import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CountUp } from "../CountUp";

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

describe("CountUp", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  it("초기 렌더는 value (SSR-safe)", async () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    const { container } = render(<CountUp value={42} />);
    // Before any animation frames, should still show value (hydration safety)
    expect(container.textContent).toContain("42");
    vi.useRealTimers();
  });
  it("prefers-reduced-motion → 즉시 value 표시", () => {
    mockReducedMotion(true);
    render(<CountUp value={7} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });
  it("value=0이면 0 표시", () => {
    mockReducedMotion(false);
    render(<CountUp value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
  it("1000 이상은 ko-KR 천단위 구분 (2,283)", () => {
    mockReducedMotion(true);
    render(<CountUp value={2283} />);
    expect(screen.getByText("2,283")).toBeInTheDocument();
  });
});
