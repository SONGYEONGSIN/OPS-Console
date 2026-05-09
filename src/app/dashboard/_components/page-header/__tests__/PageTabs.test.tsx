import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpenTabsProvider } from "../open-tabs-context";
import { PageTabs } from "../PageTabs";

const pushMock = vi.fn();
let mockPathname = "/dashboard/services";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => mockPathname,
}));

vi.mock("../../../_data", () => ({
  findSidebarMeta: (slug: string) => {
    if (slug === "services") return { label: "전체 서비스", pattern: "list" };
    if (slug === "contracts") return { label: "계약", pattern: "list" };
    return null;
  },
}));

vi.mock("../../../_data/sidebar-helpers", () => ({
  findSidebarParentGroup: (pathname: string) =>
    pathname === "/dashboard/services" || pathname === "/dashboard/contracts"
      ? "서비스사이클"
      : null,
}));

beforeEach(() => {
  localStorage.clear();
  pushMock.mockReset();
  mockPathname = "/dashboard/services";
});

const renderWithProvider = (pathname: string) =>
  render(
    <OpenTabsProvider>
      <PageTabs pathname={pathname} />
    </OpenTabsProvider>,
  );

describe("PageTabs (Epic 6)", () => {
  it("group child + tabs 있음 — 탭 렌더 (active aria-selected=true)", () => {
    mockPathname = "/dashboard/services";
    localStorage.setItem(
      "folio.openTabs",
      JSON.stringify([
        { slug: "services", href: "/dashboard/services", label: "전체 서비스" },
        { slug: "contracts", href: "/dashboard/contracts", label: "계약" },
      ]),
    );
    renderWithProvider("/dashboard/services");
    expect(screen.getByRole("tab", { name: "전체 서비스" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "계약" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("section 직속 페이지 — null 반환 (탭 영역 미노출)", () => {
    mockPathname = "/dashboard/alerts";
    const { container } = renderWithProvider("/dashboard/alerts");
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });

  it("× 클릭 — 탭 닫기 (close 호출)", () => {
    mockPathname = "/dashboard/services";
    localStorage.setItem(
      "folio.openTabs",
      JSON.stringify([
        { slug: "services", href: "/dashboard/services", label: "전체 서비스" },
        { slug: "contracts", href: "/dashboard/contracts", label: "계약" },
      ]),
    );
    renderWithProvider("/dashboard/services");
    fireEvent.click(screen.getByRole("button", { name: "계약 닫기" }));
    expect(screen.queryByRole("tab", { name: "계약" })).toBeNull();
  });
});
