import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/closing",
  useSearchParams: () => new URLSearchParams(search),
}));

import { ClosingStatusChips } from "../_StatusChips";

beforeEach(() => {
  push.mockClear();
  search = "";
});

describe("ClosingStatusChips", () => {
  it("전체/내 마감/진행중 칩 렌더 + 기본 '전체' 활성", () => {
    render(<ClosingStatusChips />);
    expect(screen.getByRole("button", { name: "전체" })).toHaveAttribute(
      "aria-pressed",
      "true",
    ); // 기본 전체
    expect(screen.getByRole("button", { name: "진행중" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "내 마감" })).toBeInTheDocument();
    // '마감' 칩은 제거됨
    expect(screen.queryByRole("button", { name: "마감" })).toBeNull();
  });

  it("진행중 클릭 → ?status=open (+ page 제거)", () => {
    search = "page=3";
    render(<ClosingStatusChips />);
    fireEvent.click(screen.getByRole("button", { name: "진행중" }));
    expect(push).toHaveBeenCalledWith("/dashboard/closing?status=open");
  });

  it("내 마감 클릭 → ?status=mine", () => {
    render(<ClosingStatusChips />);
    fireEvent.click(screen.getByRole("button", { name: "내 마감" }));
    expect(push).toHaveBeenCalledWith("/dashboard/closing?status=mine");
  });

  it("전체 클릭 → status 파라미터 제거(기본값)", () => {
    search = "status=open";
    render(<ClosingStatusChips />);
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(push).toHaveBeenCalledWith("/dashboard/closing?");
  });
});
