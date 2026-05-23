import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricGroupBox } from "../MetricGroupBox";

describe("MetricGroupBox", () => {
  it("title 렌더 + children grid 안에 표시", () => {
    render(
      <MetricGroupBox title="재정 및 영업 행정" columns={2}>
        <div>A</div>
        <div>B</div>
      </MetricGroupBox>,
    );
    expect(screen.getByText("재정 및 영업 행정")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("columns=2 → grid-cols-2", () => {
    const { container } = render(
      <MetricGroupBox title="x" columns={2}>
        <div />
      </MetricGroupBox>,
    );
    expect(container.querySelector("[data-subgrid]")?.className).toMatch(
      /grid-cols-2/,
    );
  });

  it("columns=3 → grid-cols-3", () => {
    const { container } = render(
      <MetricGroupBox title="x" columns={3}>
        <div />
      </MetricGroupBox>,
    );
    expect(container.querySelector("[data-subgrid]")?.className).toMatch(
      /grid-cols-3/,
    );
  });
});
