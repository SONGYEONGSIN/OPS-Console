import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/receivables",
  useSearchParams: () => new URLSearchParams(search),
}));

import { ReceivablesScopeChips } from "../ReceivablesScopeChips";

const counts = { all: 54, mine: 3, active: 16, approved: 14 };

beforeEach(() => {
  push.mockClear();
  search = "";
});

describe("ReceivablesScopeChips", () => {
  it("4칩 + 카운트 렌더 + 기본 '내 채권' 활성", () => {
    render(<ReceivablesScopeChips counts={counts} />);
    expect(screen.getByRole("button", { name: "내 채권" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("전체 (54)")).toBeInTheDocument();
    expect(screen.getByText("내 채권 (3)")).toBeInTheDocument();
    expect(screen.getByText("미수 (16)")).toBeInTheDocument();
    expect(screen.getByText("수금 (14)")).toBeInTheDocument();
  });

  it("전체 클릭 → ?scope=all (page 제거)", () => {
    search = "page=2";
    render(<ReceivablesScopeChips counts={counts} />);
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(push).toHaveBeenCalledWith("/dashboard/receivables?scope=all");
  });

  it("내 채권 클릭 → scope 제거(기본값)", () => {
    search = "scope=all";
    render(<ReceivablesScopeChips counts={counts} />);
    fireEvent.click(screen.getByRole("button", { name: "내 채권" }));
    expect(push).toHaveBeenCalledWith("/dashboard/receivables?");
  });
});
