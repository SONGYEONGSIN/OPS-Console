import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { OpenTabsProvider, useOpenTabs } from "../open-tabs-context";

const pushMock = vi.fn();
let mockPathname = "/dashboard/services";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => mockPathname,
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

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <OpenTabsProvider>{children}</OpenTabsProvider>
);

describe("OpenTabsProvider", () => {
  it("초기 tabs 빈 배열", () => {
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    expect(result.current.tabs).toEqual([]);
  });

  it("add — tabs 배열에 push, 중복 무시", () => {
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    act(() => result.current.add({ slug: "services", href: "/dashboard/services", label: "전체 서비스" }));
    expect(result.current.tabs).toHaveLength(1);
    act(() => result.current.add({ slug: "services", href: "/dashboard/services", label: "전체 서비스" }));
    expect(result.current.tabs).toHaveLength(1);
  });

  it("close — 비활성 탭 제거, navigate 호출 X", () => {
    mockPathname = "/dashboard/services";
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    act(() => {
      result.current.add({ slug: "services", href: "/dashboard/services", label: "전체 서비스" });
      result.current.add({ slug: "contracts", href: "/dashboard/contracts", label: "계약" });
    });
    act(() => result.current.close("contracts"));
    expect(result.current.tabs.map((t) => t.slug)).toEqual(["services"]);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("close — active 탭 닫으면 직전 탭으로 navigate", () => {
    mockPathname = "/dashboard/contracts";
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    act(() => {
      result.current.add({ slug: "services", href: "/dashboard/services", label: "전체 서비스" });
      result.current.add({ slug: "contracts", href: "/dashboard/contracts", label: "계약" });
    });
    act(() => result.current.close("contracts"));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/services");
  });

  it("close — 마지막 탭 닫으면 /dashboard 로 navigate", () => {
    mockPathname = "/dashboard/services";
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    act(() => result.current.add({ slug: "services", href: "/dashboard/services", label: "전체 서비스" }));
    act(() => result.current.close("services"));
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("localStorage — add 시 동기화", () => {
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    act(() => result.current.add({ slug: "services", href: "/dashboard/services", label: "전체 서비스" }));
    expect(JSON.parse(localStorage.getItem("folio.openTabs") ?? "[]")).toEqual([
      { slug: "services", href: "/dashboard/services", label: "전체 서비스" },
    ]);
  });

  it("localStorage — 초기화 시 복원", () => {
    localStorage.setItem(
      "folio.openTabs",
      JSON.stringify([{ slug: "services", href: "/dashboard/services", label: "전체 서비스" }]),
    );
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    expect(result.current.tabs).toHaveLength(1);
  });

  it("isGroupChild — group child true, section item false", () => {
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    expect(result.current.isGroupChild("/dashboard/services")).toBe(true);
    expect(result.current.isGroupChild("/dashboard/alerts")).toBe(false);
  });
});
