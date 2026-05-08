import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageTabs } from "../PageTabs";

vi.mock("../../../_data/sidebar-helpers", () => ({
  findSidebarSiblings: (pathname: string) => {
    if (pathname === "/dashboard/services") {
      return [
        { ico: "·", label: "전체 서비스", slug: "services", href: "/dashboard/services" },
        { ico: "·", label: "계약", slug: "contracts", href: "/dashboard/contracts" },
      ];
    }
    if (pathname === "/dashboard/alone") {
      return [
        { ico: "·", label: "외톨이", slug: "alone", href: "/dashboard/alone" },
      ];
    }
    return [];
  },
}));

describe("PageTabs", () => {
  it("형제 2개 이상 — 모두 탭으로 렌더, 활성 탭은 aria-selected=true", () => {
    render(<PageTabs pathname="/dashboard/services" />);
    const activeTab = screen.getByRole("tab", { name: "전체 서비스" });
    const inactiveTab = screen.getByRole("tab", { name: "계약" });
    expect(activeTab).toHaveAttribute("aria-selected", "true");
    expect(inactiveTab).toHaveAttribute("aria-selected", "false");
  });

  it("형제 1개 이하 — null 반환 (탭 미노출)", () => {
    const { container } = render(<PageTabs pathname="/dashboard/alone" />);
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });
});
