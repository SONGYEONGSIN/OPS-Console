import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { HandoverProgressSearch } from "../HandoverProgressSearch";

const push = vi.fn();
let mockParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/handover",
  useSearchParams: () => mockParams,
}));

describe("HandoverProgressSearch", () => {
  beforeEach(() => {
    push.mockReset();
    mockParams = new URLSearchParams();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("검색 input 렌더 + aria-label 확인", () => {
    render(<HandoverProgressSearch />);
    expect(screen.getByLabelText("인수인계 진행 검색")).toBeInTheDocument();
  });

  it("placeholder — 대학명·서비스 검색", () => {
    render(<HandoverProgressSearch />);
    expect(screen.getByPlaceholderText("대학명·서비스 검색")).toBeInTheDocument();
  });

  it("검색어 입력 후 300ms 디바운스 → URL ?q= 업데이트", async () => {
    render(<HandoverProgressSearch />);
    const input = screen.getByLabelText("인수인계 진행 검색");
    fireEvent.change(input, { target: { value: "한예종" } });
    // 디바운스 전에는 호출 없음
    expect(push).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(push).toHaveBeenCalledWith("/dashboard/handover?q=%ED%95%9C%EC%98%88%EC%A2%85");
  });

  it("기존 page 파라미터 제거", async () => {
    mockParams = new URLSearchParams("page=3");
    render(<HandoverProgressSearch />);
    const input = screen.getByLabelText("인수인계 진행 검색");
    fireEvent.change(input, { target: { value: "KARTS" } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    const called = push.mock.calls[0][0] as string;
    expect(called).toContain("q=KARTS");
    expect(called).not.toContain("page=");
  });

  it("빈 검색어 입력 시 q 파라미터 제거", async () => {
    mockParams = new URLSearchParams("q=test");
    render(<HandoverProgressSearch />);
    const input = screen.getByLabelText("인수인계 진행 검색");
    fireEvent.change(input, { target: { value: "" } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    const called = push.mock.calls[0][0] as string;
    expect(called).not.toContain("q=");
  });
});
