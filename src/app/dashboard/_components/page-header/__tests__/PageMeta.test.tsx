import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageMeta } from "../PageMeta";

describe("PageMeta", () => {
  it("items 배열을 dot separator로 렌더", () => {
    render(
      <PageMeta
        items={[
          { label: "근무 II", tone: "accent" },
          { label: "2026-04-24" },
          { label: "서비스", value: "12개" },
        ]}
      />
    );
    expect(screen.getByText("근무 II")).toBeInTheDocument();
    expect(screen.getByText("2026-04-24")).toBeInTheDocument();
    expect(screen.getByText("서비스")).toBeInTheDocument();
    expect(screen.getByText(/12개/)).toBeInTheDocument();
  });

  it("빈 items — 아무것도 렌더 안 함", () => {
    const { container } = render(<PageMeta items={[]} />);
    expect(container.querySelectorAll("span").length).toBe(0);
  });
});
