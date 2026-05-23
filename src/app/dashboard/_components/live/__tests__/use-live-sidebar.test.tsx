import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { ToastProvider } from "../ToastContainer";
import { useLiveSidebar } from "../use-live-sidebar";

function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe("useLiveSidebar", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("초기 상태: sim=false, lines 3줄", () => {
    const { result } = renderHook(() => useLiveSidebar(), { wrapper });
    expect(result.current.sim).toBe(false);
    expect(result.current.lines).toHaveLength(3);
  });

  it("onTestEvent → lines +1", () => {
    const { result } = renderHook(() => useLiveSidebar(), { wrapper });
    act(() => { result.current.onTestEvent(); });
    expect(result.current.lines).toHaveLength(4);
  });

  it("onToggleSim ON → sim=true + 즉시 1회 인입 (lines +1)", () => {
    const { result } = renderHook(() => useLiveSidebar(), { wrapper });
    act(() => { result.current.onToggleSim(); });
    expect(result.current.sim).toBe(true);
    expect(result.current.lines).toHaveLength(4);
  });

  it("onToggleSim ON → 6초 후 또 1회 인입", () => {
    const { result } = renderHook(() => useLiveSidebar(), { wrapper });
    act(() => { result.current.onToggleSim(); });
    act(() => { vi.advanceTimersByTime(6100); });
    expect(result.current.lines).toHaveLength(5);
  });

  it("onToggleSim ON → OFF → interval 멈춤", () => {
    const { result } = renderHook(() => useLiveSidebar(), { wrapper });
    act(() => { result.current.onToggleSim(); }); // ON + 즉시 1회
    act(() => { result.current.onToggleSim(); }); // OFF
    expect(result.current.sim).toBe(false);
    const baseline = result.current.lines.length;
    act(() => { vi.advanceTimersByTime(12000); });
    expect(result.current.lines).toHaveLength(baseline);
  });
});
