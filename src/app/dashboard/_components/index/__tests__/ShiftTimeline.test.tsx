import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShiftTimeline } from "../ShiftTimeline";
import type { ShiftEvent } from "../../../_data/patterns";

const sampleEvents: ShiftEvent[] = [
  { at: "14:00", label: "시프트 개시" },
  { at: "15:00", label: "PIMS 점검 회의" },
  { at: "16:30", label: "보안 스캔" },
  { at: "18:00", label: "정산 검증" },
  { at: "20:00", label: "백업 검증" },
  { at: "22:00", label: "시프트 종료" },
];

describe("ShiftTimeline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("모든 이벤트의 시각/라벨 노출", () => {
    vi.setSystemTime(new Date("2026-04-30T16:30:00+09:00"));
    render(<ShiftTimeline events={sampleEvents} startHour={14} endHour={22} />);
    sampleEvents.forEach((e) => {
      expect(screen.getByText(e.label)).toBeInTheDocument();
      expect(screen.getByText(e.at)).toBeInTheDocument();
    });
  });

  it("진행도 16:30 → 31% (2.5h / 8h)", () => {
    vi.setSystemTime(new Date("2026-04-30T16:30:00+09:00"));
    const { container } = render(
      <ShiftTimeline events={sampleEvents} startHour={14} endHour={22} />,
    );
    const progressBar = container.querySelector('[data-testid="shift-progress"]');
    expect(progressBar).not.toBeNull();
    const style = progressBar?.getAttribute("style") ?? "";
    expect(style).toMatch(/(31|31\.[0-9]+)%/);
  });

  it("시프트 시작 전 (13:30) 진행도 0%", () => {
    vi.setSystemTime(new Date("2026-04-30T13:30:00+09:00"));
    const { container } = render(
      <ShiftTimeline events={sampleEvents} startHour={14} endHour={22} />,
    );
    const progressBar = container.querySelector('[data-testid="shift-progress"]');
    expect(progressBar?.getAttribute("style") ?? "").toMatch(/0%/);
  });

  it("시프트 종료 후 (23:00) 진행도 100%", () => {
    vi.setSystemTime(new Date("2026-04-30T23:00:00+09:00"));
    const { container } = render(
      <ShiftTimeline events={sampleEvents} startHour={14} endHour={22} />,
    );
    const progressBar = container.querySelector('[data-testid="shift-progress"]');
    expect(progressBar?.getAttribute("style") ?? "").toMatch(/100%/);
  });

  it("startHour~endHour 시각 범위 라벨 노출", () => {
    vi.setSystemTime(new Date("2026-04-30T16:30:00+09:00"));
    render(<ShiftTimeline events={sampleEvents} startHour={14} endHour={22} />);
    expect(screen.getByText(/14:00 KST/)).toBeInTheDocument();
    expect(screen.getByText(/22:00 KST/)).toBeInTheDocument();
  });
});
