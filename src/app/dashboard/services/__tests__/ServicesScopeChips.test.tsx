import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ServicesScopeChips } from "../ServicesScopeChips";

const push = vi.fn();
const useSearchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => useSearchParamsMock(),
  usePathname: () => "/dashboard/services",
}));

describe("ServicesScopeChips", () => {
  beforeEach(() => {
    push.mockClear();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("기본 — 전체 칩 active + 카운트 표시", () => {
    render(<ServicesScopeChips total={2511} />);
    const all = screen.getByRole("button", { name: "전체" });
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(all.textContent).toContain("2511");
    expect(screen.getByRole("button", { name: "내 서비스" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("내 서비스 클릭 → ?mine=true + 칩 mutual exclusive", () => {
    render(<ServicesScopeChips total={2511} />);
    fireEvent.click(screen.getByRole("button", { name: "내 서비스" }));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("mine=true"));
  });

  it("mine=true 상태 — 내 서비스 active, 전체 비활성", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("mine=true"));
    render(<ServicesScopeChips total={15} />);
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
    render(<ServicesScopeChips total={15} />);
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    const arg = (push.mock.calls[0]?.[0] as string) ?? "";
    expect(arg).not.toContain("mine=true");
  });
});
