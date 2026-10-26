import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const push = vi.fn();
let params = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/internal-admin",
  useSearchParams: () => params,
}));

import { useSetParams, useDebouncedSearch } from "../_components/use-set-params";

const lastQuery = () =>
  new URLSearchParams(push.mock.calls.at(-1)![0].split("?")[1]);

describe("useSetParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams("tab=schools&page=3&q=가나");
  });

  it("patch 는 다른 파라미터를 남기고 page 를 지운다", () => {
    const { result } = renderHook(() => useSetParams());
    act(() => result.current({ gubun: "4년제" }));
    const q = lastQuery();
    expect(q.get("tab")).toBe("schools");
    expect(q.get("q")).toBe("가나");
    expect(q.get("gubun")).toBe("4년제");
    expect(q.get("page")).toBeNull();
    expect(push.mock.calls[0][0]).toMatch(/^\/dashboard\/internal-admin\?/);
  });

  it("null 은 지우고 page patch 는 남긴다", () => {
    const { result } = renderHook(() => useSetParams());
    act(() => result.current({ q: null, page: "2" }));
    const q = lastQuery();
    expect(q.get("q")).toBeNull();
    expect(q.get("page")).toBe("2");
    expect(q.get("tab")).toBe("schools");
  });

  it("빈 문자열도 지운다", () => {
    const { result } = renderHook(() => useSetParams());
    act(() => result.current({ q: "" }));
    expect(lastQuery().get("q")).toBeNull();
  });
});

describe("useDebouncedSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    params = new URLSearchParams("tab=schools&page=3");
  });
  afterEach(() => vi.useRealTimers());

  it("검색은 300ms 뒤 한 번만", () => {
    const { result } = renderHook(() => useDebouncedSearch("q"));
    act(() => result.current[1]("서울"));
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(push).toHaveBeenCalledTimes(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(push).toHaveBeenCalledTimes(1);
    const q = lastQuery();
    expect(q.get("q")).toBe("서울");
    expect(q.get("page")).toBeNull();
    expect(q.get("tab")).toBe("schools");
  });

  it("현재 파라미터로 초기화하고 빈 값은 지운다", () => {
    params = new URLSearchParams("q=서울");
    const { result } = renderHook(() => useDebouncedSearch("q"));
    expect(result.current[0]).toBe("서울");
    act(() => result.current[1](""));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(lastQuery().get("q")).toBeNull();
  });
});
