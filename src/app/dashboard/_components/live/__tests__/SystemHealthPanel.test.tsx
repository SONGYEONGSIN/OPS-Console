import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SystemHealthPanel } from "../SystemHealthPanel";

describe("SystemHealthPanel", () => {
  it("3 헬스 항목 + 값 렌더", () => {
    render(<SystemHealthPanel cronActive={false} />);
    expect(screen.getByText("시스템 게이트웨이 상태")).toBeInTheDocument();
    expect(screen.getByText("YouTube API Quota")).toBeInTheDocument();
    expect(screen.getByText("Supabase Connection")).toBeInTheDocument();
    expect(screen.getByText("Cron 자동화 엔진")).toBeInTheDocument();
    expect(screen.getByText(/67\.2%/)).toBeInTheDocument();
    expect(screen.getByText(/12ms/)).toBeInTheDocument();
    expect(screen.getByText("정상 가동")).toBeInTheDocument();
  });

  it("cronActive=true → Cron LED flicker + 텍스트 '스케줄 수집 작동 중'", () => {
    const { container } = render(<SystemHealthPanel cronActive={true} />);
    expect(screen.getByText("스케줄 수집 작동 중")).toBeInTheDocument();
    expect(screen.queryByText("정상 가동")).toBeNull();
    // 마지막 행의 LED만 flicker 클래스
    const leds = container.querySelectorAll("[data-health-led]");
    // SideBox title 우측의 main LED 1개 + 3 행의 LED 3개 = 총 4개
    expect(leds.length).toBeGreaterThanOrEqual(4);
    const cronLed = leds[leds.length - 1] as HTMLElement;
    expect(cronLed.className).toMatch(/animate-\[led-flicker_/);
    expect(cronLed.className).toMatch(/bg-vermilion/);
  });

  it("cronActive=false → Cron LED vermilion (pulse, flicker 없음)", () => {
    const { container } = render(<SystemHealthPanel cronActive={false} />);
    const leds = container.querySelectorAll("[data-health-led]");
    const cronLed = leds[leds.length - 1] as HTMLElement;
    expect(cronLed.className).toMatch(/bg-vermilion/);
    expect(cronLed.className).not.toMatch(/animate-\[led-flicker_/);
    expect(cronLed.className).toMatch(/animate-\[led-pulse_/);
  });

  it("모든 LED가 vermilion variant (Cron 포함)", () => {
    const { container } = render(<SystemHealthPanel cronActive={false} />);
    const leds = container.querySelectorAll("[data-health-led]");
    leds.forEach((led) => {
      expect((led as HTMLElement).className).toMatch(/bg-vermilion/);
    });
  });

  it("min-h-[260px] wrapper 적용", () => {
    const { container } = render(<SystemHealthPanel cronActive={false} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toMatch(/min-h-\[260px\]/);
  });
});
