import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextWeekChip } from "../NextWeekChip";

const push = vi.fn();
let mockParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/dev-test",
  useSearchParams: () => mockParams,
}));

const range = { startYmd: "2026-09-14", endYmd: "2026-09-20" };

describe("NextWeekChip — 차주오픈 토글", () => {
  beforeEach(() => {
    push.mockReset();
    mockParams = new URLSearchParams();
  });

  it("라벨과 함께 차주 범위를 보여준다 — 언제를 차주로 보는지 알아야 한다", () => {
    render(<NextWeekChip range={range} />);
    const chip = screen.getByRole("button", { name: /차주오픈/ });
    expect(chip).toHaveTextContent("9/14~9/20");
    expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  it("끈 상태에서 누르면 week=next — 내 대학·검색은 그대로, page 는 리셋", () => {
    mockParams = new URLSearchParams("mine=false&q=대&page=3");
    render(<NextWeekChip range={range} />);
    fireEvent.click(screen.getByRole("button", { name: /차주오픈/ }));
    const url = new URL(push.mock.calls[0][0], "http://x");
    expect(url.pathname).toBe("/dashboard/dev-test");
    expect(url.searchParams.get("week")).toBe("next");
    expect(url.searchParams.get("mine")).toBe("false");
    expect(url.searchParams.get("q")).toBe("대");
    expect(url.searchParams.has("page")).toBe(false);
  });

  it("켠 상태면 눌림으로 보이고, 누르면 끈다", () => {
    mockParams = new URLSearchParams("week=next&tab=test");
    render(<NextWeekChip range={range} />);
    const chip = screen.getByRole("button", { name: /차주오픈/ });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(chip);
    const url = new URL(push.mock.calls[0][0], "http://x");
    expect(url.searchParams.has("week")).toBe(false);
    expect(url.searchParams.get("tab")).toBe("test");
  });
});
