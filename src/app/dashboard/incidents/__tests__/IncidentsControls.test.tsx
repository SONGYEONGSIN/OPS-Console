import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { IncidentsControls } from "../IncidentsControls";

const push = vi.fn();
const useSearchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: push }),
  useSearchParams: () => useSearchParamsMock(),
  usePathname: () => "/dashboard/incidents",
}));

const baseProps = {
  yearOptions: ["2027", "2026", "2025"],
  defaultYear: 2027,
};

describe("IncidentsControls", () => {
  beforeEach(() => {
    push.mockClear();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("학년도 select 변경 → ?year=", () => {
    render(<IncidentsControls {...baseProps} />);
    const select = screen.getByLabelText("학년도") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2025" } });
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("year=2025"),
    );
  });

  it("현재상황 select 변경 → ?status=", () => {
    render(<IncidentsControls {...baseProps} />);
    const select = screen.getByLabelText("현재상황 필터") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "처리완료" } });
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("status=%EC%B2%98%EB%A6%AC%EC%99%84%EB%A3%8C"),
    );
  });

  it("담당부서 select 변경 → ?department=", () => {
    render(<IncidentsControls {...baseProps} />);
    const select = screen.getByLabelText("담당부서 필터") as HTMLSelectElement;
    fireEvent.change(select, {
      target: { value: "운영부-운영1팀" },
    });
    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(/department=.+/),
    );
  });

  it("검색 input debounce 후 ?q=", () => {
    vi.useFakeTimers();
    render(<IncidentsControls {...baseProps} />);
    const input = screen.getByLabelText("사고 검색") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "결제" } });
    expect(push).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(push).toHaveBeenCalledWith(expect.stringContaining("q="));
  });

  it("빈 select 값(전체) → param 제거", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("status=처리중"));
    render(<IncidentsControls {...baseProps} />);
    const select = screen.getByLabelText("현재상황 필터") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "" } });
    expect(push).toHaveBeenCalled();
    const url = push.mock.calls[push.mock.calls.length - 1]?.[0] as string;
    expect(url).not.toContain("status=");
  });
});
