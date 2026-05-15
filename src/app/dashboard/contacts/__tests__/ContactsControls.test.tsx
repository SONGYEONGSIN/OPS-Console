import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ContactsControls } from "../ContactsControls";

const push = vi.fn();
const useSearchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => useSearchParamsMock(),
  usePathname: () => "/dashboard/contacts",
}));

describe("ContactsControls", () => {
  beforeEach(() => {
    push.mockClear();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    vi.useFakeTimers();
  });

  it("검색 + 3 select 노출 (직책/관리등급/관계등급)", () => {
    render(<ContactsControls />);
    expect(
      screen.getByPlaceholderText("고객명·대학명 검색"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("직책 필터")).toBeInTheDocument();
    expect(screen.getByLabelText("관리 등급 필터")).toBeInTheDocument();
    expect(screen.getByLabelText("관계 등급 필터")).toBeInTheDocument();
  });

  it("직책 select 변경 → ?jobRole=실무자", () => {
    render(<ContactsControls />);
    fireEvent.change(screen.getByLabelText("직책 필터"), {
      target: { value: "실무자" },
    });
    expect(push).toHaveBeenCalledWith(expect.stringContaining("jobRole="));
  });

  it("검색 debounce 300ms → ?q=", () => {
    render(<ContactsControls />);
    fireEvent.change(screen.getByPlaceholderText("고객명·대학명 검색"), {
      target: { value: "김지" },
    });
    act(() => vi.advanceTimersByTime(300));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("q="));
  });
});
