import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { OpenTabsProvider, useOpenTabs } from "../open-tabs-context";
import { useAutoAddTab } from "../use-auto-add-tab";

let mockPathname = "/dashboard/services";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => mockPathname,
}));

vi.mock("../../../_data", () => ({
  findSidebarMeta: (slug: string) => {
    if (slug === "services") return { label: "서비스", pattern: "list" };
    if (slug === "contracts") return { label: "계약", pattern: "list" };
    if (slug === "alerts") return { label: "새 알림", pattern: "dash" };
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
  mockPathname = "/dashboard/services";
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <OpenTabsProvider>{children}</OpenTabsProvider>
);

describe("useAutoAddTab", () => {
  it("group child pathname — 탭 자동 push", () => {
    mockPathname = "/dashboard/services";
    const { result } = renderHook(
      () => {
        useAutoAddTab();
        return useOpenTabs();
      },
      { wrapper: Wrapper },
    );
    expect(result.current.tabs.map((t) => t.slug)).toEqual(["services"]);
  });

  it("section 직속 pathname — push 안 함", () => {
    mockPathname = "/dashboard/alerts";
    const { result } = renderHook(
      () => {
        useAutoAddTab();
        return useOpenTabs();
      },
      { wrapper: Wrapper },
    );
    expect(result.current.tabs).toEqual([]);
  });
});
