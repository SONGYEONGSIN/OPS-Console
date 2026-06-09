import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/receivables",
  useSearchParams: () => new URLSearchParams(search),
}));

import { ReceivablesControls } from "../ReceivablesControls";

beforeEach(() => {
  push.mockClear();
  search = "";
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("ReceivablesControls", () => {
  it("검색 input 렌더 + 초기값(?q) 반영", () => {
    search = "q=서울대";
    render(<ReceivablesControls />);
    const box = screen.getByRole("searchbox") as HTMLInputElement;
    expect(box).toBeInTheDocument();
    expect(box.value).toBe("서울대");
  });

  it("입력 → debounce 후 ?q= 로 이동", () => {
    render(<ReceivablesControls />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "한양" },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(decodeURIComponent(url)).toContain("q=한양");
  });
});
