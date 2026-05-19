import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DomainHeatmap } from "../DomainHeatmap";

describe("DomainHeatmap", () => {
  const rows = [
    { domain: "PIMS", pending: 2, inProgress: 3, done: 1 },
    { domain: "접수", pending: 0, inProgress: 2, done: 4 },
    { domain: "결제", pending: 4, inProgress: 0, done: 1 },
  ];

  it("도메인 row + 3 컬럼 헤더 렌더", () => {
    render(<DomainHeatmap rows={rows} />);
    expect(screen.getByText("대기")).toBeInTheDocument();
    expect(screen.getByText("진행")).toBeInTheDocument();
    expect(screen.getByText("완료")).toBeInTheDocument();
    expect(screen.getByText("PIMS")).toBeInTheDocument();
    expect(screen.getByText("결제")).toBeInTheDocument();
  });

  it("cell에 카운트 노출 (0이면 · 점)", () => {
    render(<DomainHeatmap rows={rows} />);
    // PIMS pending=2 / 접수 pending=0
    const pimsRow = screen.getByTestId("heatmap-row-PIMS");
    expect(pimsRow).toHaveTextContent("2");
    const receptionRow = screen.getByTestId("heatmap-row-접수");
    expect(receptionRow).toHaveTextContent("·");
  });

  it("빈 배열 — 안내 텍스트", () => {
    render(<DomainHeatmap rows={[]} />);
    expect(screen.getByText(/도메인 데이터 없음/)).toBeInTheDocument();
  });
});
