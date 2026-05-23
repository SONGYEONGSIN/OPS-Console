import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveIndicator } from "../LiveIndicator";

describe("LiveIndicator", () => {
  it("실시간 모니터 텍스트 + vermilion 보더 박스", () => {
    const { container } = render(<LiveIndicator />);
    expect(screen.getByText(/실시간 모니터/)).toBeInTheDocument();
    expect(container.firstChild).toHaveProperty("className");
    expect((container.firstChild as HTMLElement).className).toMatch(
      /border-vermilion/
    );
  });

  it("LED dot이 pulse 클래스 가짐", () => {
    const { container } = render(<LiveIndicator />);
    const dot = container.querySelector("[data-live-dot]");
    expect(dot?.className).toMatch(/animate-\[live-pulse_/);
  });
});
