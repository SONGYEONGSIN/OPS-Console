import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { AutoRefreshCountdown } from "../AutoRefreshCountdown";

describe("AutoRefreshCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refreshMock.mockClear();
    // jsdom visibilityState 기본 'visible' 보장
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("30초 경과 시 router.refresh()를 1회 호출 (그 전엔 미호출)", () => {
    render(<AutoRefreshCountdown />);
    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(refreshMock).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("두 주기(60초) 경과 시 2회 호출", () => {
    render(<AutoRefreshCountdown />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(refreshMock).toHaveBeenCalledTimes(2);
  });
});
