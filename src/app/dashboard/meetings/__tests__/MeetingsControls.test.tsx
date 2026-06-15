import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/meetings",
  useSearchParams: () => new URLSearchParams(search),
}));

import { MeetingsControls } from "../MeetingsControls";

beforeEach(() => {
  push.mockClear();
  search = "";
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("MeetingsControls", () => {
  it("유형 select와 검색 input을 렌더한다 (검색창이 먼저)", () => {
    render(<MeetingsControls />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const box = screen.getByRole("searchbox") as HTMLInputElement;
    expect(select).toBeInTheDocument();
    expect(box).toBeInTheDocument();
    // 검색창(넓게)이 DOM 순서상 유형 select보다 앞 (contracts 패턴 동일)
    expect(
      box.compareDocumentPosition(select) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("유형 select 옵션은 한글 라벨로 노출된다", () => {
    render(<MeetingsControls />);
    expect(screen.getByRole("option", { name: "유형 전체" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "정기회의" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "외근·출장 보고" }),
    ).toBeInTheDocument();
  });

  it("초기값(?type) 영문 type을 한글 라벨로 선택 반영한다", () => {
    search = "type=field";
    render(<MeetingsControls />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("외근·출장 보고");
  });

  it("유형 변경 시 URL ?type= 에 영문 type을 저장하고 page를 초기화한다", () => {
    search = "page=3";
    render(<MeetingsControls />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "정기회의" },
    });
    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain("type=regular");
    expect(url).not.toContain("page=");
  });

  it("유형 전체 선택 시 ?type= 를 제거한다", () => {
    search = "type=regular";
    render(<MeetingsControls />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "" },
    });
    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(url).not.toContain("type=");
  });

  it("검색 입력 → debounce 후 ?q= 로 이동(page 초기화)", () => {
    search = "page=2";
    render(<MeetingsControls />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "운영" },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(decodeURIComponent(url)).toContain("q=운영");
    expect(url).not.toContain("page=");
  });
});
