/**
 * services 페이지 컨트롤 — 검색 input + 본인 토글.
 * - 입력 300ms debounce → router.push("?q=한양")
 * - 본인 토글 → router.push("?mine=true")
 * - mine=true 상태에서 토글 → mine 제거
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ServicesControls } from "../ServicesControls";

const push = vi.fn();
const useSearchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: push }),
  useSearchParams: () => useSearchParamsMock(),
  usePathname: () => "/dashboard/services",
}));

describe("ServicesControls", () => {
  beforeEach(() => {
    push.mockClear();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("검색 input에 타이핑하면 debounce 후 ?q= 로 router.push", () => {
    vi.useFakeTimers();
    render(<ServicesControls />);

    const input = screen.getByPlaceholderText(/대학|검색/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "한양" } });
    expect(push).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("q=%ED%95%9C%EC%96%91"),
    );
  });

  it("내 담당 토글 클릭 → ?mine=true", () => {
    render(<ServicesControls />);
    const toggle = screen.getByRole("button", { name: /내 담당/ });
    fireEvent.click(toggle);
    expect(push).toHaveBeenCalledWith(expect.stringContaining("mine=true"));
  });

  it("내 담당이 이미 true면 클릭 시 mine 제거", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("mine=true"));
    render(<ServicesControls />);
    const toggle = screen.getByRole("button", { name: /내 담당/ });
    fireEvent.click(toggle);
    const arg = (push.mock.calls[0]?.[0] as string) ?? "";
    expect(arg).not.toContain("mine=true");
  });
});
