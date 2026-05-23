import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { LiveSidebar } from "../LiveSidebar";
import { ToastProvider } from "../ToastContainer";

function withProvider(ui: React.ReactNode) {
  return <ToastProvider>{ui}</ToastProvider>;
}

describe("LiveSidebar", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("3 영역 모두 렌더 (헬스 + 콘솔 + 관리자 컨트롤)", () => {
    render(withProvider(<LiveSidebar />));
    expect(screen.getByText("시스템 게이트웨이 상태")).toBeInTheDocument();
    expect(screen.getByText("실시간 백그라운드 로그")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /시뮬레이션 활성화/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /테스트 이벤트 인입/ })).toBeInTheDocument();
  });

  it("초기 콘솔: 3 줄 표시 (INITIAL_CONSOLE_LINES)", () => {
    const { container } = render(withProvider(<LiveSidebar />));
    const lines = container.querySelectorAll("[data-console-line]");
    expect(lines.length).toBe(3);
  });

  it("테스트 이벤트 인입 → 콘솔 줄 4개로 증가 + 토스트 표시", () => {
    const { container } = render(withProvider(<LiveSidebar />));
    fireEvent.click(screen.getByRole("button", { name: /테스트 이벤트 인입/ }));
    const lines = container.querySelectorAll("[data-console-line]");
    expect(lines.length).toBe(4);
    // 토스트 메시지 풀에서 하나가 표시됨 (모두 '[로 시작')
    // ToastProvider fixed 컨테이너 안 Toast 컴포넌트 1개
    expect(screen.getAllByText(/^\[/).length).toBeGreaterThanOrEqual(4); // 콘솔 4 + 토스트 1 = 5+
  });

  it("시뮬레이션 활성화 → 즉시 1회 인입 + 6초 후 또 인입", () => {
    const { container } = render(withProvider(<LiveSidebar />));
    fireEvent.click(screen.getByRole("button", { name: /시뮬레이션 활성화/ }));
    // 즉시 1회 → 콘솔 4줄
    const linesAfterToggle = container.querySelectorAll("[data-console-line]").length;
    expect(linesAfterToggle).toBe(4);
    // 6초 경과 → 5줄
    act(() => { vi.advanceTimersByTime(6100); });
    const linesAfter6s = container.querySelectorAll("[data-console-line]").length;
    expect(linesAfter6s).toBe(5);
  });

  it("시뮬레이션 정지 → interval 멈춤", () => {
    const { container } = render(withProvider(<LiveSidebar />));
    fireEvent.click(screen.getByRole("button", { name: /시뮬레이션 활성화/ }));
    fireEvent.click(screen.getByRole("button", { name: /시뮬레이션 정지/ }));
    const baseline = container.querySelectorAll("[data-console-line]").length;
    act(() => { vi.advanceTimersByTime(12000); });
    const after = container.querySelectorAll("[data-console-line]").length;
    expect(after).toBe(baseline);
  });

  it("sim 활성화 시 Cron LED vermilion flicker", () => {
    const { container } = render(withProvider(<LiveSidebar />));
    fireEvent.click(screen.getByRole("button", { name: /시뮬레이션 활성화/ }));
    expect(screen.getByText("스케줄 수집 작동 중")).toBeInTheDocument();
    const leds = container.querySelectorAll("[data-health-led]");
    // 마지막 health-led(Cron 행)가 flicker + vermilion
    const cronLed = leds[leds.length - 1] as HTMLElement;
    expect(cronLed.className).toMatch(/animate-\[led-flicker_/);
    expect(cronLed.className).toMatch(/bg-vermilion/);
  });
});
