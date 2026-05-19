import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AlertsBell } from "../AlertsBell";
import type { DashWidget } from "../patterns/DashPattern";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// fixture는 DashWidget 시그니처(label/value/time)에 맞춤. v2 동작(hover/click)을 검증한다.
const fixtures: DashWidget[] = [
  { id: "a1", tone: "urgent", label: "긴급 1", value: "350ms", time: "14:23" },
  { id: "a2", tone: "review", label: "검토 1", value: "12건", time: "현재" },
];

beforeEach(() => {
  vi.useFakeTimers();
  pushMock.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("AlertsBell v2", () => {
  it("urgent 카운트 배지 표시", () => {
    render(<AlertsBell items={fixtures} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("호버 200ms 후 드롭다운 표시", () => {
    render(<AlertsBell items={fixtures} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /알림/ }));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByText("긴급 1")).toBeInTheDocument();
  });

  it("종 클릭 시 /dashboard 이동 (실시간 현황 1면)", () => {
    render(<AlertsBell items={fixtures} />);
    fireEvent.click(screen.getByRole("button", { name: /알림/ }));
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });
});
