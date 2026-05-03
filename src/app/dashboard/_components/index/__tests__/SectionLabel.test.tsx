import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionLabel } from "../SectionLabel";

describe("SectionLabel", () => {
  it("kicker 텍스트 노출", () => {
    render(<SectionLabel kicker="prj" title="12 운영 프로젝트" />);
    expect(screen.getByText("prj")).toBeInTheDocument();
  });

  it("title 텍스트 노출", () => {
    render(<SectionLabel kicker="prj" title="12 운영 프로젝트" />);
    expect(screen.getByText("12 운영 프로젝트")).toBeInTheDocument();
  });

  it("kicker는 vermilion 톤 강조 (text-vermilion 클래스)", () => {
    const { container } = render(<SectionLabel kicker="prj" title="제목" />);
    const kicker = container.querySelector('[data-testid="section-kicker"]');
    expect(kicker?.className).toContain("text-vermilion");
  });
});
