import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { ToastProvider, useToast } from "../ToastContainer";

function TriggerButton({ msg = "[사고] 테스트" }: { msg?: string }) {
  const { showToast } = useToast();
  return <button onClick={() => showToast(msg)}>fire</button>;
}

describe("ToastProvider + useToast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("showToast 호출 시 토스트 표시", () => {
    render(<ToastProvider><TriggerButton /></ToastProvider>);
    act(() => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(screen.getByText(/테스트/)).toBeInTheDocument();
  });

  it("3.5초 + 페이드아웃 0.3초 후 DOM에서 제거", () => {
    render(<ToastProvider><TriggerButton /></ToastProvider>);
    act(() => fireEvent.click(screen.getByRole("button")));
    expect(screen.getByText(/테스트/)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByText(/테스트/)).toBeNull();
  });

  it("여러 토스트 동시 stack", () => {
    render(<ToastProvider><TriggerButton msg="[사고] one" /></ToastProvider>);
    act(() => fireEvent.click(screen.getByRole("button")));
    act(() => fireEvent.click(screen.getByRole("button")));
    expect(screen.getAllByText(/one/).length).toBe(2);
  });

  it("Provider 없이 useToast 호출 시 에러", () => {
    // useToast가 Provider 밖에서 throw 하는지
    const Bad = () => { useToast(); return null; };
    expect(() => render(<Bad />)).toThrow();
  });
});
