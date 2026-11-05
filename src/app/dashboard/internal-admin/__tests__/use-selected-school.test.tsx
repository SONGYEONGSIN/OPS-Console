import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

let params = new URLSearchParams("tab=sms&view=numbers&q=가나");

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/internal-admin",
  useSearchParams: () => params,
}));

import { useSelectedSchool } from "../_components/use-selected-school";

describe("useSelectedSchool", () => {
  let replace: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    params = new URLSearchParams("tab=sms&view=numbers&q=가나");
    replace = vi.spyOn(window.history, "replaceState");
  });
  afterEach(() => replace.mockRestore());

  const lastUrl = () => String(replace.mock.calls.at(-1)![2]);

  it("주소에 school 이 없으면 null", () => {
    const { result } = renderHook(() => useSelectedSchool());
    expect(result.current[0]).toBeNull();
  });

  it("?school=No 딥링크로 시작한다 — 이상한 값은 null", () => {
    params = new URLSearchParams("school=3");
    expect(renderHook(() => useSelectedSchool()).result.current[0]).toBe(3);
    params = new URLSearchParams("school=abc");
    expect(renderHook(() => useSelectedSchool()).result.current[0]).toBeNull();
  });

  it("고르면 상태가 바로 바뀌고 주소는 replaceState 로만 — 다른 파라미터는 남긴다", () => {
    const { result } = renderHook(() => useSelectedSchool());
    act(() => result.current[1](2));
    expect(result.current[0]).toBe(2);
    const url = new URL(lastUrl(), "http://x");
    expect(url.pathname).toBe("/dashboard/internal-admin");
    expect(url.searchParams.get("school")).toBe("2");
    expect(url.searchParams.get("view")).toBe("numbers");
    expect(url.searchParams.get("q")).toBe("가나");
  });

  it("닫으면(null) 주소에서 school 을 지운다", () => {
    params = new URLSearchParams("view=schools&school=1");
    const { result } = renderHook(() => useSelectedSchool());
    act(() => result.current[1](null));
    expect(result.current[0]).toBeNull();
    expect(lastUrl()).toBe("/dashboard/internal-admin?view=schools");
  });

  it("바깥에서 주소가 바뀌면 그 값으로 맞춘다", () => {
    const { result, rerender } = renderHook(() => useSelectedSchool());
    params = new URLSearchParams("school=5");
    rerender();
    expect(result.current[0]).toBe(5);
  });
});
