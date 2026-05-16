import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { HandoverControls } from "../HandoverControls";

const push = vi.fn();
const useSearchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: push }),
  useSearchParams: () => useSearchParamsMock(),
  usePathname: () => "/dashboard/handover",
}));

describe("HandoverControls", () => {
  beforeEach(() => {
    push.mockClear();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("검색 input debounce 후 ?q=", () => {
    vi.useFakeTimers();
    render(<HandoverControls />);
    const input = screen.getByLabelText("인수인계 검색") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "서울" } });
    expect(push).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(push).toHaveBeenCalledWith(expect.stringContaining("q="));
  });

  it("작성상태 select 변경 → ?status=", () => {
    render(<HandoverControls />);
    const select = screen.getByLabelText("작성상태 필터") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "ready" } });
    expect(push).toHaveBeenCalledWith(expect.stringContaining("status=ready"));
  });

  it("빈 status 값 → param 제거", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("status=ready"));
    render(<HandoverControls />);
    const select = screen.getByLabelText("작성상태 필터") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "" } });
    const url = push.mock.calls[push.mock.calls.length - 1]?.[0] as string;
    expect(url).not.toContain("status=");
  });
});
