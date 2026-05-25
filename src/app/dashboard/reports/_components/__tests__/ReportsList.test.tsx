import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReportsList } from "../ReportsList";
import type { ReportRow } from "@/features/reports/schemas";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));
vi.mock("@/features/reports/actions", () => ({
  createReport: vi.fn(),
}));

const sample: ReportRow = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "2026 5월 운영 리포트",
  period: "this-month",
  periodStart: "2026-05-01",
  periodEnd: "2026-05-31",
  kpis: [],
  status: "completed",
  shareToken: null,
  createdBy: "ys1114@x.com",
  createdAt: "2026-05-31T10:00:00Z",
};

describe("ReportsList — 테이블 형식", () => {
  it("헤더 5컬럼 (제목/기간/기간 범위/생성일/상태)", () => {
    render(<ReportsList reports={[]} />);
    expect(screen.getByText("제목")).toBeInTheDocument();
    expect(screen.getByText("기간")).toBeInTheDocument();
    expect(screen.getByText("기간 범위")).toBeInTheDocument();
    expect(screen.getByText("생성일")).toBeInTheDocument();
    expect(screen.getByText("상태")).toBeInTheDocument();
  });

  it("빈 reports → 안내문구", () => {
    render(<ReportsList reports={[]} />);
    expect(screen.getByText(/저장된 리포트가 없습니다/)).toBeInTheDocument();
  });

  it("리포트 행 렌더 + 한국어 기간 라벨 + 상태 칩", () => {
    render(<ReportsList reports={[sample]} />);
    expect(screen.getByText(/2026 5월 운영 리포트/)).toBeInTheDocument();
    expect(screen.getByText("이번 달")).toBeInTheDocument();
    expect(screen.getByText("2026-05-01 ~ 2026-05-31")).toBeInTheDocument();
    expect(screen.getByText("완료")).toBeInTheDocument();
  });

  it("행 클릭 → /dashboard/reports/[id] router.push", () => {
    pushMock.mockClear();
    render(<ReportsList reports={[sample]} />);
    fireEvent.click(screen.getByText(/2026 5월/));
    expect(pushMock).toHaveBeenCalledWith(
      `/dashboard/reports/${sample.id}`,
    );
  });
});
