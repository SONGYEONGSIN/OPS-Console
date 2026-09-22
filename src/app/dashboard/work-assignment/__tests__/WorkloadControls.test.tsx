import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";

const push = vi.fn();
let params = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/work-assignment",
  useSearchParams: () => params,
}));

import { WorkloadControls } from "../WorkloadControls";

/**
 * 배정현황 조작줄 — **다른 목록 메뉴와 같은 자리, 같은 모양**(사용자 지적 2026-09-22).
 *
 * `ServicesControls` 가 정본이다: 검색창 + 필터 select 가 섹션 **밖** 한 줄에 서고
 * (`px-7 pt-3`), 검색은 300ms 뒤 한 번만 옮기며 `page` 를 버린다. 학년도는 칩이
 * 아니라 `ListSelect` 다 — 설계 문서가 그렇게 적었고, 다른 메뉴의 대학구분·카테고리
 * 필터가 같은 자리에 같은 모양으로 선다.
 *
 * **다른 파라미터를 지우면 안 된다.** 이 화면은 `?tab=` 과 `?year=` 로 무엇을 볼지
 * 정하는데, 검색이 그걸 날리면 글자를 치는 순간 2027학년도 배정현황으로 튄다.
 */
const YEARS = [2027, 2026] as const;

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
    render(<WorkloadControls years={YEARS} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
  };

  it("치고 나서 잠깐 뒤에 한 번만 옮긴다 — 글자마다 옮기면 서버를 두드린다", () => {
    render(<WorkloadControls years={YEARS} />);
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

    render(<WorkloadControls years={YEARS} />);

    expect(screen.getByRole("searchbox")).toHaveValue("가운");
  });

  it("주소와 같은 값이면 옮기지 않는다 — 무한 루프가 된다", () => {
    params = new URLSearchParams("q=가운");

    render(<WorkloadControls years={YEARS} />);
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(push).not.toHaveBeenCalled();
  });

  it("한 줄에 나란히 선다 — 다른 메뉴와 같은 자리다", () => {
    /*
     * 섹션 머리 오른쪽에 끼워 넣었더니 이 화면만 검색창 위치가 달랐다. 정본은
     * `ServicesControls` 의 `px-7 pt-3` 한 줄이다.
     */
    const { container } = render(<WorkloadControls years={YEARS} />);

    const row = container.firstElementChild!;
    expect(row.className).toMatch(/px-7/);
    expect(row.className).toMatch(/pt-3/);
    expect(within(row as HTMLElement).getByRole("searchbox")).toBeTruthy();
    expect(within(row as HTMLElement).getByRole("combobox")).toBeTruthy();
  });

  describe("학년도", () => {
    it("칩이 아니라 select 다 — 다른 메뉴의 필터와 같은 모양이다", () => {
      render(<WorkloadControls years={YEARS} />);

      const select = screen.getByRole("combobox", { name: /학년도/ });
      expect(
        within(select).getAllByRole("option").map((o) => o.textContent),
      ).toEqual(["2027학년도", "2026학년도"]);
    });

    it("지금 보는 학년도가 골라져 있다", () => {
      params = new URLSearchParams("year=2026");

      render(<WorkloadControls years={YEARS} />);

      expect(screen.getByRole("combobox", { name: /학년도/ })).toHaveValue(
        "2026학년도",
      );
    });

    it("주소에 학년도가 없으면 첫 값이다 — 빈 칸으로 두면 무엇을 보는지 모른다", () => {
      params = new URLSearchParams();

      render(<WorkloadControls years={YEARS} />);

      expect(screen.getByRole("combobox", { name: /학년도/ })).toHaveValue(
        "2027학년도",
      );
    });

    it("고르면 바로 옮긴다 — 필터는 기다릴 이유가 없다", () => {
      render(<WorkloadControls years={YEARS} />);

      fireEvent.change(screen.getByRole("combobox", { name: /학년도/ }), {
        target: { value: "2026학년도" },
      });

      expect(push).toHaveBeenCalledTimes(1);
      expect(push.mock.calls[0][0]).toContain("year=2026");
    });

    it("학년도를 바꾸면 검색어와 쪽 번호를 버린다", () => {
      /*
       * 학년도가 바뀌면 사람도 대학도 달라진다 — 찾던 말이 그대로 남으면 빈 표가
       * 나오고, 사람은 '그 해에는 아무도 없다' 로 읽는다.
       */
      params = new URLSearchParams("q=가운&page=3&tab=workload");

      render(<WorkloadControls years={YEARS} />);
      fireEvent.change(screen.getByRole("combobox", { name: /학년도/ }), {
        target: { value: "2026학년도" },
      });

      const url = push.mock.calls[0][0] as string;
      expect(url).not.toContain("q=");
      expect(url).not.toContain("page=");
      expect(url).toContain("tab=workload");
    });
  });

  it("무엇으로 찾는지 칸이 말한다 — 사람만인지 대학도인지 알 수 없다", () => {
    render(<WorkloadControls years={YEARS} />);

    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "placeholder",
      expect.stringMatching(/담당자.*대학|대학.*담당자/),
    );
  });
});
