import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const push = vi.fn();
let params = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/work-assignment",
  useSearchParams: () => params,
}));

import { WorkloadControls } from "../WorkloadControls";

/**
 * 배정현황 검색창 — `?q=` 규약은 `ServicesControls` 와 같다(300ms · `page` 삭제).
 *
 * **다른 파라미터를 지우면 안 된다.** 이 화면은 `?tab=` 과 `?year=` 로 무엇을 볼지
 * 정하는데, 검색이 그걸 날리면 글자를 치는 순간 2027학년도 배정현황으로 튄다.
 */
describe("WorkloadControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    params = new URLSearchParams("tab=workload&year=2026");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const type = (value: string) => {
    render(<WorkloadControls />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
  };

  it("치고 나서 잠깐 뒤에 한 번만 옮긴다 — 글자마다 옮기면 서버를 두드린다", () => {
    render(<WorkloadControls />);
    const box = screen.getByRole("searchbox");

    fireEvent.change(box, { target: { value: "가" } });
    fireEvent.change(box, { target: { value: "가운" } });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toContain("q=%EA%B0%80%EC%9A%B4");
  });

  it("탭과 학년도를 지키고 간다", () => {
    type("가운");

    const url = push.mock.calls[0][0] as string;
    expect(url).toContain("tab=workload");
    expect(url).toContain("year=2026");
  });

  it("쪽 번호는 버린다 — 3쪽에서 검색하면 빈 화면이 나온다", () => {
    params = new URLSearchParams("tab=workload&page=3");

    type("가운");

    expect(push.mock.calls[0][0]).not.toContain("page");
  });

  it("지우면 검색어를 뗀다 — 빈 `q=` 가 남으면 주소가 지저분해진다", () => {
    params = new URLSearchParams("tab=workload&q=가운");

    type("");

    expect(push.mock.calls[0][0]).not.toContain("q=");
  });

  it("주소의 검색어를 처음 값으로 든다 — 새로고침하면 칸이 비면 안 된다", () => {
    params = new URLSearchParams("q=가운");

    render(<WorkloadControls />);

    expect(screen.getByRole("searchbox")).toHaveValue("가운");
  });

  it("주소와 같은 값이면 옮기지 않는다 — 무한 루프가 된다", () => {
    params = new URLSearchParams("q=가운");

    render(<WorkloadControls />);
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(push).not.toHaveBeenCalled();
  });

  it("무엇으로 찾는지 칸이 말한다 — 사람만인지 대학도인지 알 수 없다", () => {
    render(<WorkloadControls />);

    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "placeholder",
      expect.stringMatching(/담당자.*대학|대학.*담당자/),
    );
  });
});
