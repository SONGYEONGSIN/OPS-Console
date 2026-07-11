import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CrumbBar } from "../CrumbBar";
import { OpenTabsProvider } from "../open-tabs-context";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/services",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("../../../_data/sidebar-helpers", () => ({
  findSidebarBreadcrumb: () => [{ label: "운영" }, { label: "서비스" }],
  findSidebarSiblings: () => [],
  findSidebarParentGroup: () => null,
}));

describe("CrumbBar", () => {
  const renderInProvider = () =>
    render(
      <OpenTabsProvider>
        <CrumbBar pathname="/dashboard/services" />
      </OpenTabsProvider>,
    );

  it("breadcrumb 라벨을 노출", () => {
    renderInProvider();
    expect(screen.getByText("운영")).toBeInTheDocument();
    expect(screen.getByText("서비스")).toBeInTheDocument();
  });

  it("sidebar 배경(왼쪽 메뉴바와 동일 톤) + 하단 line-soft 보더 적용", () => {
    const { container } = renderInProvider();
    const bar = container.querySelector("div.bg-sidebar");
    expect(bar).not.toBeNull();
    expect(bar?.className).toContain("border-b");
    expect(bar?.className).toContain("border-line-soft");
  });
});
