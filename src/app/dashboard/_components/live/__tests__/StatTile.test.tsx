import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatTile } from "../StatTile";

describe("StatTile", () => {
  it("라벨 + 카운트 + 보조 노출", () => {
    render(<StatTile label="서비스" value={27} sub="active" href="/dashboard/services" />);
    expect(screen.getByText("서비스")).toBeInTheDocument();
    expect(screen.getByText("27")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("href 있으면 anchor로 wrap", () => {
    render(<StatTile label="사고" value={2} sub="active" href="/dashboard/incidents" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/dashboard/incidents");
  });

  it("href 없으면 anchor 아님", () => {
    render(<StatTile label="K12" value={1} sub="prep" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
