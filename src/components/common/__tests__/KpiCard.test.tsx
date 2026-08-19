import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCard } from "../KpiCard";
import type { KpiItem } from "@/features/reports/schemas";

function kpi(over: Partial<KpiItem> = {}): KpiItem {
  return {
    key: "service-open",
    label: "서비스 오픈",
    value: 32,
    prevValue: 31,
    delta: 1,
    deltaPct: 3.2,
    unit: "건",
    goodOnIncrease: true,
    ...over,
  };
}

describe("KpiCard", () => {
  it("라벨 + 값 + 단위 표시", () => {
    render(<KpiCard item={kpi()} />);
    expect(screen.getByText("서비스 오픈")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
    expect(screen.getByText("건")).toBeInTheDocument();
  });

  it("증가 + goodOnIncrease=true → ▲ + 증감 + good 톤", () => {
    const { container } = render(
      <KpiCard item={kpi({ delta: 1, deltaPct: 3.2, goodOnIncrease: true })} />,
    );
    expect(container.textContent ?? "").toContain("▲");
    expect(container.textContent ?? "").toContain("1");
  });

  it("감소 + goodOnIncrease=false (사고) → ▼ + good 톤", () => {
    const { container } = render(
      <KpiCard
        item={kpi({
          key: "incident",
          label: "사고",
          value: 12,
          prevValue: 15,
          delta: -3,
          deltaPct: -20,
          goodOnIncrease: false,
        })}
      />,
    );
    expect(container.textContent ?? "").toContain("▼");
    expect(container.textContent ?? "").toContain("3");
  });

  it("prevValue null → 증감 표시 없음 ('비교 불가' 또는 '신규')", () => {
    render(
      <KpiCard
        item={kpi({ prevValue: null, delta: null, deltaPct: null })}
      />,
    );
    expect(screen.queryByText(/▲|▼/)).toBeNull();
  });
});
