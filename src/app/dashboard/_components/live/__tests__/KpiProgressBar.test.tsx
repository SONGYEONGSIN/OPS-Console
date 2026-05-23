import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiProgressBar } from "../KpiProgressBar";

describe("KpiProgressBar", () => {
  it("done/total 표시 + width % 계산", () => {
    const { container } = render(<KpiProgressBar done={2} total={10} />);
    expect(screen.getByText("2 / 10")).toBeInTheDocument();
    const fill = container.querySelector("[data-progress-fill]") as HTMLElement;
    expect(fill.style.width).toBe("20%");
  });

  it("total=0이면 0% (분모 0 방어)", () => {
    const { container } = render(<KpiProgressBar done={0} total={0} />);
    const fill = container.querySelector("[data-progress-fill]") as HTMLElement;
    expect(fill.style.width).toBe("0%");
  });

  it("done > total일 때도 100% 상한", () => {
    const { container } = render(<KpiProgressBar done={15} total={10} />);
    const fill = container.querySelector("[data-progress-fill]") as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });
});
