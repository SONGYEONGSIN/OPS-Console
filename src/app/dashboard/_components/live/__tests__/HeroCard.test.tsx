import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroCard } from "../HeroCard";

describe("HeroCard", () => {
  it("kicker + 메인 값 + 보조 정보 노출", () => {
    render(
      <HeroCard
        kicker="마감 임박"
        primary="D-3"
        title="건국대학교"
        subtitle="정시 1차 접수"
      />,
    );
    expect(screen.getByText("마감 임박")).toBeInTheDocument();
    expect(screen.getByText("D-3")).toBeInTheDocument();
    expect(screen.getByText("건국대학교")).toBeInTheDocument();
    expect(screen.getByText("정시 1차 접수")).toBeInTheDocument();
  });

  it("tone=urgent — vermilion 강조", () => {
    render(
      <HeroCard
        kicker="미수채권"
        primary="2,150만원"
        title="14일 경과"
        subtitle="12건"
        tone="urgent"
      />,
    );
    expect(screen.getByText("2,150만원").className).toMatch(/vermilion/);
  });
});
