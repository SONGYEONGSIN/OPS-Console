import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/closing",
  useSearchParams: () => new URLSearchParams(search),
}));

import { ClosingControls } from "../ClosingControls";

beforeEach(() => {
  push.mockClear();
  search = "";
});

describe("ClosingControls", () => {
  it("검색 input + 카테고리 셀렉트 렌더", () => {
    render(<ClosingControls categories={["수시", "정시"]} />);
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    const select = screen.getByLabelText("카테고리 필터") as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.querySelectorAll("option").length).toBe(3); // 전체 + 2
  });

  it("카테고리 변경 → ?category= 로 이동(page 초기화)", () => {
    search = "page=2";
    render(<ClosingControls categories={["수시", "정시"]} />);
    fireEvent.change(screen.getByLabelText("카테고리 필터"), {
      target: { value: "수시" },
    });
    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(decodeURIComponent(url)).toContain("category=수시");
    expect(url).not.toContain("page=");
  });
});
