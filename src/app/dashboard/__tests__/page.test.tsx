import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardIndexPage from "../page";

describe("DashboardIndexPage (실시간 현황)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T16:42:00+09:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Masthead 'OPSROOM 일간' + vol 노출", () => {
    render(<DashboardIndexPage />);
    expect(screen.getByText(/OPSROOM/)).toBeInTheDocument();
    expect(screen.getByText(/일간/)).toBeInTheDocument();
    expect(screen.getByText(/vol\.214/)).toBeInTheDocument();
  });

  it("Lede headline 노출", () => {
    render(<DashboardIndexPage />);
    expect(screen.getAllByText(/현재 긴급/).length).toBeGreaterThanOrEqual(1);
  });

  it("12개 프로젝트 진입점 노출", () => {
    const { container } = render(<DashboardIndexPage />);
    const projectLinks = container.querySelectorAll(
      'a[href^="/dashboard/"]:not([href="/dashboard/"])',
    );
    expect(projectLinks.length).toBeGreaterThanOrEqual(12);
  });

  it("OnCall 1차/2차 운영자 노출", () => {
    render(<DashboardIndexPage />);
    expect(screen.getAllByText(/송영신/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/한효진/).length).toBeGreaterThanOrEqual(1);
  });

  it("ShiftTimeline 14:00 KST / 22:00 KST 범위 노출", () => {
    render(<DashboardIndexPage />);
    expect(screen.getAllByText(/14:00 KST/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/22:00 KST/).length).toBeGreaterThanOrEqual(1);
  });
});
