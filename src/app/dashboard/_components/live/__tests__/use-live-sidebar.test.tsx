import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { ToastProvider } from "../ToastContainer";
import { useLiveSidebar } from "../use-live-sidebar";
import type { ConsoleLogEntry } from "../mock-log-pool";

// ── useDashboardRealtime mock ────────────────────────────────────────────────
// useLiveSidebar → useDashboardRealtime 합성 구조이므로 Realtime 자체는 mock.
// onConsoleLine 콜백만 추출해서 테스트에서 수동 호출.
let capturedOnConsoleLine: ((line: ConsoleLogEntry) => void) | null = null;

vi.mock("../use-dashboard-realtime", () => ({
  useDashboardRealtime: ({ onConsoleLine }: { onConsoleLine: (line: ConsoleLogEntry) => void }) => {
    capturedOnConsoleLine = onConsoleLine;
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe("useLiveSidebar", () => {
  it("초기 상태: INITIAL_CONSOLE_LINES 3줄", () => {
    const { result } = renderHook(() => useLiveSidebar(), { wrapper });
    expect(result.current.lines).toHaveLength(3);
  });

  it("opts.initialLines 전달 시 그 값으로 초기화", () => {
    const customLines: ConsoleLogEntry[] = [
      { text: "[CUSTOM] hi", type: "info" },
    ];
    const { result } = renderHook(
      () => useLiveSidebar({ initialLines: customLines }),
      { wrapper },
    );
    expect(result.current.lines).toEqual(customLines);
  });

  it("opts.initialLines 빈 배열이면 INITIAL_CONSOLE_LINES로 fallback", () => {
    const { result } = renderHook(
      () => useLiveSidebar({ initialLines: [] }),
      { wrapper },
    );
    expect(result.current.lines.length).toBeGreaterThan(0);
  });

  it("Realtime onConsoleLine 호출 시 lines에 추가", () => {
    const { result } = renderHook(() => useLiveSidebar(), { wrapper });
    const before = result.current.lines.length;

    act(() => {
      capturedOnConsoleLine?.({ text: "[TEST] 새 로그", type: "info" });
    });

    expect(result.current.lines).toHaveLength(before + 1);
    expect(result.current.lines[result.current.lines.length - 1].text).toBe(
      "[TEST] 새 로그",
    );
  });

  it("lines가 50건 초과 시 최신 50건만 유지 (CAP)", () => {
    const fiftyLines: ConsoleLogEntry[] = Array.from({ length: 50 }, (_, i) => ({
      text: `[LINE] ${i}`,
      type: "info" as const,
    }));
    const { result } = renderHook(
      () => useLiveSidebar({ initialLines: fiftyLines }),
      { wrapper },
    );
    // 1개 더 추가하면 51 → slice → 50
    act(() => {
      capturedOnConsoleLine?.({ text: "[NEW] 넘침", type: "warn" });
    });
    expect(result.current.lines).toHaveLength(50);
    expect(result.current.lines[49].text).toBe("[NEW] 넘침");
  });
});
