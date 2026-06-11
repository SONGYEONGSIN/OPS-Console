import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

import { LiveClock } from "../LiveClock";

// 2026-06-11 (목) 15:24:07 KST = 2026-06-11 06:24:07 UTC
const FIXED = new Date("2026-06-11T06:24:07.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("LiveClock", () => {
  it("마운트 직후엔 placeholder 시각을 렌더한다 (SSR hydration 일치)", () => {
    render(<LiveClock />);
    expect(screen.getByText("--:--:--")).toBeInTheDocument();
  });

  it("첫 tick(1000ms) 후 KST 실제 시각으로 채워진다", () => {
    render(<LiveClock />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("15:24:08")).toBeInTheDocument();
    expect(screen.queryByText("--:--:--")).not.toBeInTheDocument();
  });

  it("날짜(yyyy-MM-dd)와 요일 표기가 존재한다", () => {
    render(<LiveClock />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText(/2026-06-11/)).toBeInTheDocument();
    expect(screen.getByText(/\(목\)/)).toBeInTheDocument();
  });

  it("KST 라벨을 표기한다", () => {
    render(<LiveClock />);
    expect(screen.getByText("KST")).toBeInTheDocument();
  });

  it("tabular-nums 클래스로 시각을 정렬한다", () => {
    render(<LiveClock />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const time = screen.getByText("15:24:08");
    expect(time.className).toContain("tabular-nums");
  });
});
