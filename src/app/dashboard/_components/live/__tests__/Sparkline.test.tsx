import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Sparkline } from "../Sparkline";

describe("Sparkline", () => {
  it("d prop으로 SVG path 렌더", () => {
    const { container } = render(<Sparkline d="M 0,30 L 100,2" />);
    const path = container.querySelector("svg path");
    expect(path?.getAttribute("d")).toBe("M 0,30 L 100,2");
  });

  it("default(danger) → stroke-vermilion", () => {
    const { container } = render(<Sparkline d="M 0,0" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class") ?? "").toMatch(/stroke-vermilion/);
  });

  it("variant 'neutral' → stroke-ink", () => {
    const { container } = render(<Sparkline d="M 0,0" variant="neutral" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class") ?? "").toMatch(/stroke-ink/);
  });
});
