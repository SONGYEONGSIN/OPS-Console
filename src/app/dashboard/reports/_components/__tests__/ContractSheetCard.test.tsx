import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContractSheetCard } from "../ContractSheetCard";
import type { KpiItem } from "@/features/reports/schemas";

const item: KpiItem = {
  key: "contract",
  label: "계약 체결",
  value: 129,
  prevValue: null,
  delta: null,
  deltaPct: null,
  unit: "건",
  goodOnIncrease: true,
  breakdown: [
    { label: "4년제", value: 62, total: 70 },
    { label: "전문대", value: 35, total: 42 },
  ],
};

describe("ContractSheetCard", () => {
  it("카드 제목·시트별 라벨을 표시", () => {
    render(<ContractSheetCard item={item} />);
    expect(screen.getByText("계약 체결")).toBeInTheDocument();
    expect(screen.getByText("4년제")).toBeInTheDocument();
    expect(screen.getByText("전문대")).toBeInTheDocument();
  });

  it("시트별 완료 건수와 전체 건수를 함께 표시", () => {
    render(<ContractSheetCard item={item} />);
    expect(screen.getByText("62")).toBeInTheDocument();
    expect(screen.getByText(/\/\s*70/)).toBeInTheDocument();
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(screen.getByText(/\/\s*42/)).toBeInTheDocument();
  });

  it("시트별 완료율을 표시 (62/70 → 88.6%)", () => {
    render(<ContractSheetCard item={item} />);
    expect(screen.getByText(/88\.6%/)).toBeInTheDocument();
    expect(screen.getByText(/83\.3%/)).toBeInTheDocument();
  });

  it("breakdown이 없으면 시트 컬럼을 렌더하지 않는다", () => {
    const noBreakdown: KpiItem = { ...item, breakdown: undefined };
    render(<ContractSheetCard item={noBreakdown} />);
    expect(screen.getByText("계약 체결")).toBeInTheDocument();
    expect(screen.queryByText("4년제")).not.toBeInTheDocument();
  });
});
