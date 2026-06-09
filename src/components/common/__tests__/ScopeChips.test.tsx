import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScopeChips } from "../ScopeChips";

const push = vi.fn();
const useSearchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => useSearchParamsMock(),
  usePathname: () => "/dashboard/services",
}));

describe("ScopeChips", () => {
  beforeEach(() => {
    push.mockClear();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("기본 — param 없으면 내것 칩 active + 전체 비활성", () => {
    render(<ScopeChips total={2511} mineLabel="내 서비스" />);
    const all = screen.getByRole("button", { name: "전체" });
    const mine = screen.getByRole("button", { name: "내 서비스" });
    expect(mine).toHaveAttribute("aria-pressed", "true");
    expect(all).toHaveAttribute("aria-pressed", "false");
    expect(all.textContent).toContain("2511");
  });

  it("전체 칩 클릭 → ?mine=false", () => {
    render(<ScopeChips total={2511} mineLabel="내 계약" />);
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("mine=false"));
  });

  it("mine=false 상태 — 전체 chip active, 내것 비활성", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("mine=false"));
    render(<ScopeChips total={15} mineLabel="내 서비스" />);
    expect(screen.getByRole("button", { name: "전체" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "내 서비스" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("mine=false에서 내것 클릭 → mine 제거 (기본 내것 복귀)", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("mine=false"));
    render(<ScopeChips total={15} mineLabel="내 서비스" />);
    fireEvent.click(screen.getByRole("button", { name: "내 서비스" }));
    const arg = (push.mock.calls[0]?.[0] as string) ?? "";
    expect(arg).not.toContain("mine=false");
    expect(arg).not.toContain("mine=true");
  });
});
