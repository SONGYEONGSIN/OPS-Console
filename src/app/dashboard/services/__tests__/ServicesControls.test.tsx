/**
 * services 페이지 — 검색 input + 대학구분/카테고리 select.
 * 본인 칩과 페이지네이션은 별도 컴포넌트(ServicesMineChip / ServicesPagination)로 분리됨.
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

  it("카테고리 select 변경 → ?category=", () => {
    render(<ServicesControls />);
    const select = screen.getByLabelText("카테고리 필터") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "수시" } });
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("category=%EC%88%98%EC%8B%9C"),
    );
  });

  it("대학구분 select 변경 → ?universityType=", () => {
    render(<ServicesControls />);
    const select = screen.getByLabelText("대학구분 필터") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "4년제" } });
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("universityType="),
    );
  });
});
