import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { SessionTimer } from "../SessionTimer";

const signOutMock = vi.fn();
vi.mock("@/features/auth/actions", () => ({
  signOut: () => signOutMock(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  signOutMock.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("SessionTimer", () => {
  it("초기 표시 15:00", () => {
    render(<SessionTimer />);
    expect(screen.getByText("15:00")).toBeInTheDocument();
  });

  it("1초 경과 → 14:59", () => {
    render(<SessionTimer />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("14:59")).toBeInTheDocument();
  });

  it("mousemove 활동 시 리셋", () => {
    render(<SessionTimer />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("14:00")).toBeInTheDocument();
    act(() => fireEvent.mouseMove(document));
    expect(screen.getByText("15:00")).toBeInTheDocument();
  });

  it("15분 idle 시 signOut 호출", () => {
    render(<SessionTimer />);
    act(() => vi.advanceTimersByTime(15 * 60 * 1000));
    expect(signOutMock).toHaveBeenCalledOnce();
  });
});
