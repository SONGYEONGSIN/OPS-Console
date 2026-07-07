import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiGrid } from "../KpiGrid";
import type { KpiItem } from "@/features/reports/schemas";

function kpi(key: KpiItem["key"], label: string, value: number): KpiItem {
  return {
    key,
    label,
    value,
    prevValue: null,
    delta: null,
    deltaPct: null,
    unit: "건",
    goodOnIncrease: true,
  };
}

describe("KpiGrid", () => {
  it("오픈+마감 있으면 통합 카드(오픈/마감 서브라벨) + 나머지 KpiCard", () => {
    const kpis = [
      kpi("service-open", "서비스 오픈", 90),
      kpi("service-close", "서비스 마감", 125),
      kpi("incident", "사고", 0),
    ];
    render(<KpiGrid kpis={kpis} />);
    // 통합 카드: 서브라벨 오픈/마감 + 두 값
    expect(screen.getByText("오픈")).toBeInTheDocument();
    expect(screen.getByText("마감")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText("125")).toBeInTheDocument();
    // 나머지 카드
    expect(screen.getByText("사고")).toBeInTheDocument();
  });

  it("마감이 없으면(구형 리포트) 통합 대신 단일 '서비스 오픈' 카드", () => {
    const kpis = [
      kpi("service-open", "서비스 오픈", 151),
      kpi("incident", "사고", 3),
    ];
    render(<KpiGrid kpis={kpis} />);
    expect(screen.getByText("서비스 오픈")).toBeInTheDocument();
    expect(screen.queryByText("마감")).not.toBeInTheDocument();
    expect(screen.getByText("사고")).toBeInTheDocument();
  });
});
