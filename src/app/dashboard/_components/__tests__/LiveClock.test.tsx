import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { LiveClock } from "../LiveClock";

describe("LiveClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-04T16:42:08+09:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("YYYY.MM.DD (요일) HH:MM:SS 형식으로 노출", async () => {
    await act(async () => {
      render(<LiveClock />);
    });
    expect(screen.getByText(/2026\.05\.04/)).toBeInTheDocument();
    expect(screen.getByText(/\(월\)/)).toBeInTheDocument();
    expect(screen.getByText(/16:42:08/)).toBeInTheDocument();
  });

  it("매초마다 시각 갱신", async () => {
    await act(async () => {
      render(<LiveClock />);
    });
    expect(screen.getByText(/16:42:08/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText(/16:42:10/)).toBeInTheDocument();
  });

  it("'실시간 연결' 표시 함께 노출", async () => {
    await act(async () => {
      render(<LiveClock />);
    });
    expect(screen.getByText(/실시간 연결/)).toBeInTheDocument();
  });
});
