import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ContractsControls } from "../ContractsControls";

const push = vi.fn();
const useSearchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => useSearchParamsMock(),
  usePathname: () => "/dashboard/contracts",
}));

describe("ContractsControls", () => {
  beforeEach(() => {
    push.mockClear();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    vi.useFakeTimers();
  });

  it("검색 + 시트 select 노출", () => {
    render(<ContractsControls />);
    expect(
      screen.getByPlaceholderText("대학명·넘버링 검색"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("시트 필터")).toBeInTheDocument();
  });

  it("시트 select 변경 → ?sheet=4년제", () => {
    render(<ContractsControls />);
    fireEvent.change(screen.getByLabelText("시트 필터"), {
      target: { value: "4년제" },
    });
    expect(push).toHaveBeenCalledWith(expect.stringContaining("sheet="));
  });

  it("검색 debounce 300ms → ?q=", () => {
    render(<ContractsControls />);
    fireEvent.change(screen.getByPlaceholderText("대학명·넘버링 검색"), {
      target: { value: "가천" },
    });
    act(() => vi.advanceTimersByTime(300));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("q="));
  });
});
