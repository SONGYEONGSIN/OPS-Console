import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SystemHealthPanel } from "../SystemHealthPanel";

describe("SystemHealthPanel", () => {
  it("3 헬스 항목 + 값 렌더", () => {
    render(<SystemHealthPanel />);
    expect(screen.getByText("시스템 게이트웨이 상태")).toBeInTheDocument();
    expect(screen.getByText("YouTube API Quota")).toBeInTheDocument();
    expect(screen.getByText("Supabase Connection")).toBeInTheDocument();
    expect(screen.getByText("Cron 자동화 엔진")).toBeInTheDocument();
    expect(screen.getByText(/67\.2%/)).toBeInTheDocument();
    expect(screen.getByText(/12ms/)).toBeInTheDocument();
    expect(screen.getByText("정상 가동")).toBeInTheDocument();
  });

  it("Cron LED — vermilion pulse, flicker 없음 (항상)", () => {
    const { container } = render(<SystemHealthPanel />);
    const leds = container.querySelectorAll("[data-health-led]");
    const cronLed = leds[leds.length - 1] as HTMLElement;
    expect(cronLed.className).toMatch(/bg-vermilion/);
    expect(cronLed.className).not.toMatch(/animate-\[led-flicker_/);
    expect(cronLed.className).toMatch(/animate-\[led-pulse_/);
  });

  it("모든 LED가 vermilion variant", () => {
    const { container } = render(<SystemHealthPanel />);
    const leds = container.querySelectorAll("[data-health-led]");
    leds.forEach((led) => {
      expect((led as HTMLElement).className).toMatch(/bg-vermilion/);
    });
  });

  it("SideBox border-ink 클래스 포함", () => {
    const { container } = render(<SystemHealthPanel />);
    expect((container.firstChild as HTMLElement).className).toMatch(/border-ink/);
  });
});
