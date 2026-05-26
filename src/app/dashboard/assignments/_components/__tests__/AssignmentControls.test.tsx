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
    render(<AssignmentControls universityTypeOptions={["4년제", "전문대학"]} />);
    expect(
      screen.getByPlaceholderText("대학명·담당자명 검색"),
    ).toBeInTheDocument();
  });

  it("검색 debounce 300ms → ?q=", () => {
    render(<AssignmentControls universityTypeOptions={["4년제", "전문대학"]} />);
    fireEvent.change(screen.getByPlaceholderText("대학명·담당자명 검색"), {
      target: { value: "고려" },
    });
    act(() => vi.advanceTimersByTime(300));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("q="));
  });

  it("대분류 select 변경 → ?universityType= 즉시 push", () => {
    render(<AssignmentControls universityTypeOptions={["4년제", "전문대학"]} />);
    fireEvent.change(screen.getByLabelText("대분류 필터"), {
      target: { value: "전문대학" },
    });
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("universityType=%EC%A0%84%EB%AC%B8%EB%8C%80%ED%95%99"),
    );
  });

  it("placeholder 옵션 '대분류 전체' 노출", () => {
    render(<AssignmentControls universityTypeOptions={["4년제"]} />);
    expect(screen.getByRole("option", { name: "대분류 전체" })).toBeInTheDocument();
  });
});
