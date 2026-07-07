import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceFlowCard } from "../ServiceFlowCard";
import type { KpiItem } from "@/features/reports/schemas";

const open: KpiItem = {
  key: "service-open",
  label: "서비스 오픈",
  value: 90,
  prevValue: 65,
  delta: 25,
  deltaPct: 38.5,
  unit: "건",
  goodOnIncrease: true,
};
const close: KpiItem = {
  key: "service-close",
  label: "서비스 마감",
  value: 125,
  prevValue: null,
  delta: null,
  deltaPct: null,
  unit: "건",
  goodOnIncrease: true,
};

describe("ServiceFlowCard", () => {
  it("오픈·마감 값과 서브 라벨을 한 카드에 표시", () => {
    render(<ServiceFlowCard open={open} close={close} />);
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText("125")).toBeInTheDocument();
    expect(screen.getByText("오픈")).toBeInTheDocument();
    expect(screen.getByText("마감")).toBeInTheDocument();
  });

  it("오픈 증감(+38.5%) 표시, 마감은 비교 불가", () => {
    render(<ServiceFlowCard open={open} close={close} />);
    expect(screen.getByText(/38\.5%/)).toBeInTheDocument();
    expect(screen.getByText("비교 불가")).toBeInTheDocument();
  });
});
