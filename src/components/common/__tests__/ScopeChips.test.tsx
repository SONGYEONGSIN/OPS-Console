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

  it("기본 — 전체 칩 active + 카운트 + mineLabel 노출", () => {
    render(<ScopeChips total={2511} mineLabel="내 서비스" />);
    const all = screen.getByRole("button", { name: "전체" });
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(all.textContent).toContain("2511");
    expect(screen.getByRole("button", { name: "내 서비스" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("mine 칩 클릭 → ?mine=true", () => {
    render(<ScopeChips total={2511} mineLabel="내 계약" />);
    fireEvent.click(screen.getByRole("button", { name: "내 계약" }));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("mine=true"));
  });

  it("mine=true 상태 — mine chip active, 전체 비활성", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("mine=true"));
    render(<ScopeChips total={15} mineLabel="내 서비스" />);
    expect(screen.getByRole("button", { name: "내 서비스" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "전체" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("mine=true에서 전체 클릭 → mine 제거", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("mine=true"));
    render(<ScopeChips total={15} mineLabel="내 서비스" />);
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    const arg = (push.mock.calls[0]?.[0] as string) ?? "";
    expect(arg).not.toContain("mine=true");
  });
});
