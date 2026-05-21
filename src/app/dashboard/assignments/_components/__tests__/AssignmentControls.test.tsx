import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AssignmentControls } from "../AssignmentControls";

const push = vi.fn();
const useSearchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => useSearchParamsMock(),
  usePathname: () => "/dashboard/assignments",
}));

describe("AssignmentControls", () => {
  beforeEach(() => {
    push.mockClear();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    vi.useFakeTimers();
  });

  it("대학명·담당자명 검색 input 노출", () => {
    render(<AssignmentControls />);
    expect(
      screen.getByPlaceholderText("대학명·담당자명 검색"),
    ).toBeInTheDocument();
  });

  it("검색 debounce 300ms → ?q=", () => {
    render(<AssignmentControls />);
    fireEvent.change(screen.getByPlaceholderText("대학명·담당자명 검색"), {
      target: { value: "고려" },
    });
    act(() => vi.advanceTimersByTime(300));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("q="));
  });
});
