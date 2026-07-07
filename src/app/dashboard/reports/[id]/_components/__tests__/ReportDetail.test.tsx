import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportDetail } from "../ReportDetail";
import type { ReportRow } from "@/features/reports/schemas";

// EditableTitle(useRouter) + ShareControls(액션) client 의존성 모킹
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/features/reports/actions", () => ({
  updateReportTitle: vi.fn(),
  toggleReportShare: vi.fn(),
}));

const sample: ReportRow = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "2026 5월 운영 리포트",
  period: "this-month",
  periodStart: "2026-05-01",
  periodEnd: "2026-05-31",
  kpis: [
    {
      key: "service-open",
      label: "서비스 오픈",
      value: 32,
      prevValue: 31,
      delta: 1,
      deltaPct: 3.2,
      unit: "건",
      goodOnIncrease: true,
    },
    {
      key: "incident",
      label: "사고",
      value: 12,
      prevValue: 15,
      delta: -3,
      deltaPct: -20,
      unit: "건",
      goodOnIncrease: false,
    },
  ],
  status: "completed",
  shareToken: null,
  createdBy: "ys1114@x.com",
  createdAt: "2026-05-31T10:00:00Z",
};

describe("ReportDetail", () => {
  it("리포트 제목 + 기간 표시", () => {
    render(<ReportDetail report={sample} />);
    expect(screen.getByText("2026 5월 운영 리포트")).toBeInTheDocument();
    expect(screen.getByText(/2026-05-01.*2026-05-31/)).toBeInTheDocument();
  });

  it("저장된 KPI 카드 모두 렌더", () => {
    render(<ReportDetail report={sample} />);
    expect(screen.getByText("서비스 오픈")).toBeInTheDocument();
    expect(screen.getByText("사고")).toBeInTheDocument();
  });

  it("PDF 다운로드 링크 표시", () => {
    render(<ReportDetail report={sample} />);
    const link = screen.getByText(/PDF/).closest("a");
    expect(link).toHaveAttribute("href", `/api/reports/${sample.id}/pdf`);
  });
});
