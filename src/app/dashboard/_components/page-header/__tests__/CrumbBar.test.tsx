import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CrumbBar } from "../CrumbBar";
import { OpenTabsProvider } from "../open-tabs-context";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/services",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("../../../_data/sidebar-helpers", () => ({
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

  it("washi-raised 배경 + 하단 line-soft 보더 적용", () => {
    const { container } = renderInProvider();
    const bar = container.querySelector("div.bg-washi-raised");
    expect(bar).not.toBeNull();
    expect(bar?.className).toContain("border-b");
    expect(bar?.className).toContain("border-line-soft");
  });
});
