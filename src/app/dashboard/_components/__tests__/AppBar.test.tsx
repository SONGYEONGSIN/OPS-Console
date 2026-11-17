import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppBar } from "../AppBar";
import { SidebarToggleProvider } from "../sidebar-toggle-context";

vi.mock("../LiveClock", () => ({
  LiveClock: () => <span data-testid="live-clock-stub">CLOCK</span>,
}));

describe("AppBar", () => {
  it("'메뉴 열기' aria-label 버튼이 렌더되고 클릭 시 Provider.open 호출", () => {
    const openSpy = vi.fn();
    render(
      <SidebarToggleProvider open={openSpy}>
        <AppBar />
      </SidebarToggleProvider>,
    );
    const btn = screen.getByRole("button", { name: "메뉴 열기" });
    expect(btn).toHaveAttribute("aria-controls", "sidebar");
    fireEvent.click(btn);
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it("1023px 이하(모바일·태블릿)에서 보인다 — 서랍 메뉴 열기 버튼이 있어야 한다", () => {
    render(
      <SidebarToggleProvider open={() => {}}>
        <AppBar />
      </SidebarToggleProvider>,
    );
    const bar = screen.getByRole("banner").className.split(/\s+/);
    expect(bar).toContain("max-lg:flex");
    expect(bar).not.toContain("max-md:flex");
  });

  it("OPS Console 라벨 + LiveClock 슬롯 노출", () => {
    render(
      <SidebarToggleProvider open={() => {}}>
        <AppBar />
      </SidebarToggleProvider>,
    );
    expect(screen.getByText("OPS Console")).toBeInTheDocument();
    expect(screen.getByTestId("live-clock-stub")).toBeInTheDocument();
  });
});
