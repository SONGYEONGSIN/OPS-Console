import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCardLarge } from "../KpiCardLarge";

function mockReducedMotion() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      media: "",
      dispatchEvent: () => false,
    }),
  });
}

describe("KpiCardLarge", () => {
  beforeEach(() => mockReducedMotion());

  it("label / trend / count / footer 렌더", () => {
    render(
      <KpiCardLarge
        label="미해결 사고 현황"
        trend="실시간 경보"
        trendDanger
        count={3}
        numberDanger
        footer="전체 관리 대상 중 즉각 조치 필요 건수"
        right={<div data-slot>SPK</div>}
      />,
    );
    expect(screen.getByText("미해결 사고 현황")).toBeInTheDocument();
    expect(screen.getByText("실시간 경보")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/즉각 조치 필요/)).toBeInTheDocument();
  });
  it("numberDanger=true → 큰 숫자 text-vermilion", () => {
    const { container } = render(
      <KpiCardLarge label="x" trend="x" count={1} numberDanger footer="x" />,
    );
    expect(container.querySelector("[data-kpi-number]")?.className).toMatch(/text-vermilion/);
  });
  it("numberDanger 없으면 큰 숫자 text-ink", () => {
    const { container } = render(
      <KpiCardLarge label="x" trend="x" count={1} footer="x" />,
    );
    expect(container.querySelector("[data-kpi-number]")?.className).toMatch(/text-ink/);
  });
  it("trendDanger=true → trend tag border-vermilion + text-vermilion", () => {
    const { container } = render(
      <KpiCardLarge label="x" trend="경보" trendDanger count={0} footer="x" />,
    );
    const tag = container.querySelector("[data-trend-tag]") as HTMLElement;
    expect(tag.className).toMatch(/border-vermilion/);
    expect(tag.className).toMatch(/text-vermilion/);
  });
  it("trendDanger 없으면 trend tag default (border-ink/text-ink-soft)", () => {
    const { container } = render(
      <KpiCardLarge label="x" trend="안정" count={5} footer="x" />,
    );
    const tag = container.querySelector("[data-trend-tag]") as HTMLElement;
    expect(tag.className).toMatch(/border-ink(?!-)/);
  });
  it("right prop이 우측 슬롯에 렌더", () => {
    render(
      <KpiCardLarge
        label="x" trend="y" count={2} footer="z"
        right={<div data-testid="rightslot">RIGHT</div>}
      />,
    );
    expect(screen.getByTestId("rightslot")).toBeInTheDocument();
  });
});
