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

const opts = {
  categoryOptions: ["수시", "정시"],
  universityTypeOptions: ["4년제"],
  admissionTypeOptions: ["반응형원서", "공통원서"],
};

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
    render(<DevControlSearch {...opts} />);
    expect(screen.getByLabelText("개발 탭 검색")).toBeInTheDocument();
  });

  it("placeholder — 대학명·서비스명 검색", () => {
    render(<DevControlSearch {...opts} />);
    expect(
      screen.getByPlaceholderText("대학명·서비스명 검색"),
    ).toBeInTheDocument();
  });

  it("테스트 탭과 동일 필터 셀렉트 노출 (지역 제외)", () => {
    render(<DevControlSearch {...opts} />);
    expect(screen.getByLabelText("카테고리 필터")).toBeInTheDocument();
    expect(screen.getByLabelText("대학구분 필터")).toBeInTheDocument();
    expect(screen.getByLabelText("접수구분 필터")).toBeInTheDocument();
    expect(screen.queryByLabelText("지역 필터")).toBeNull();
  });

  it("접수구분 선택 시 searchParam 이동 + page 리셋", () => {
    mockParams = new URLSearchParams("page=2");
    render(<DevControlSearch {...opts} />);
    fireEvent.change(screen.getByLabelText("접수구분 필터"), {
      target: { value: "반응형원서" },
    });
    expect(push).toHaveBeenCalled();
    const called = push.mock.calls[0][0] as string;
    expect(called).toContain("admissionType=");
    expect(called).not.toContain("page=");
  });

  it("검색어 입력 후 300ms 디바운스 → URL ?q= 업데이트", async () => {
    render(<DevControlSearch {...opts} />);
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
    render(<DevControlSearch {...opts} />);
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
    render(<DevControlSearch {...opts} />);
    const input = screen.getByLabelText("개발 탭 검색");
    fireEvent.change(input, { target: { value: "" } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    const called = push.mock.calls[0][0] as string;
    expect(called).not.toContain("q=");
  });
});
