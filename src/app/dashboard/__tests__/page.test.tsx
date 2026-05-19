import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardIndexPage from "../page";

describe("DashboardIndexPage (실시간 현황 — HUD 콕핏)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T16:42:00+09:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("HUD 헤더 — OPSROOM + 실시간 현황 + 온듀티", () => {
    render(<DashboardIndexPage />);
    expect(screen.getByText(/OPSROOM/)).toBeInTheDocument();
    expect(screen.getByText(/실시간 현황 HUD/)).toBeInTheDocument();
    expect(screen.getByText(/온듀티/)).toBeInTheDocument();
  });

  it("3 zone (좌·중·우) 노출", () => {
    render(<DashboardIndexPage />);
    expect(screen.getByTestId("hud-left")).toBeInTheDocument();
    expect(screen.getByTestId("hud-center")).toBeInTheDocument();
    expect(screen.getByTestId("hud-right")).toBeInTheDocument();
  });

  it("좌 zone — 나 KPI 라벨 노출 (할 일·담당·인수인계·미수)", () => {
    render(<DashboardIndexPage />);
    expect(screen.getByText(/할 일/)).toBeInTheDocument();
    expect(screen.getByText(/담당 서비스/)).toBeInTheDocument();
    expect(screen.getByText(/인수인계 진행/)).toBeInTheDocument();
    expect(screen.getByText(/미수 발송/)).toBeInTheDocument();
  });

  it("중 zone — D-N 카운트다운 + 도메인 Heatmap", () => {
    render(<DashboardIndexPage />);
    expect(screen.getByText(/D-N 카운트다운/)).toBeInTheDocument();
    expect(screen.getByText(/상태 Heatmap/)).toBeInTheDocument();
    expect(screen.getByText("D-3")).toBeInTheDocument();
  });

  it("우 zone — 시스템 신호 (시프트/온콜/SLA/알림)", () => {
    render(<DashboardIndexPage />);
    expect(screen.getAllByText(/시프트/).length).toBeGreaterThan(0);
    expect(screen.getByText(/한효진/)).toBeInTheDocument();
    expect(screen.getByText("99.7%")).toBeInTheDocument();
    expect(screen.getAllByText(/알림/).length).toBeGreaterThan(0);
  });

  it("하단 EventTicker — 이벤트 라벨 노출", () => {
    render(<DashboardIndexPage />);
    expect(screen.getByTestId("hud-ticker")).toBeInTheDocument();
    expect(screen.getByText(/결제 350ms/)).toBeInTheDocument();
  });
});
