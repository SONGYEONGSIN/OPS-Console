import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DevControlSearch } from "../DevControlSearch";

const push = vi.fn();
let mockParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/dev-test",
  useSearchParams: () => mockParams,
}));

describe("DevControlSearch", () => {
  beforeEach(() => {
    push.mockReset();
    mockParams = new URLSearchParams();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("검색 input 렌더 + aria-label 확인", () => {
    render(<DevControlSearch />);
    expect(screen.getByLabelText("개발 탭 검색")).toBeInTheDocument();
  });

  it("placeholder — 대학명·서비스명 검색", () => {
    render(<DevControlSearch />);
    expect(
      screen.getByPlaceholderText("대학명·서비스명 검색"),
    ).toBeInTheDocument();
  });

  it("검색어 입력 후 300ms 디바운스 → URL ?q= 업데이트", async () => {
    render(<DevControlSearch />);
    const input = screen.getByLabelText("개발 탭 검색");
    fireEvent.change(input, { target: { value: "9998793" } });
    expect(push).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(push).toHaveBeenCalledWith("/dashboard/dev-test?q=9998793");
  });

  it("기존 page 파라미터 제거", async () => {
    mockParams = new URLSearchParams("tab=dev&page=3");
    render(<DevControlSearch />);
    const input = screen.getByLabelText("개발 탭 검색");
    fireEvent.change(input, { target: { value: "가나대" } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    const called = push.mock.calls[0][0] as string;
    expect(called).toContain("tab=dev");
    expect(called).not.toContain("page=");
  });

  it("빈 검색어 입력 시 q 파라미터 제거", async () => {
    mockParams = new URLSearchParams("tab=dev&q=test");
    render(<DevControlSearch />);
    const input = screen.getByLabelText("개발 탭 검색");
    fireEvent.change(input, { target: { value: "" } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    const called = push.mock.calls[0][0] as string;
    expect(called).not.toContain("q=");
  });
});
