import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { StickyKpiBar } from "../_components/StickyKpiBar";

type Cb = (entries: { isIntersecting: boolean }[]) => void;
let observed: { cb: Cb; target: Element | null; disconnected: boolean } | null =
  null;

beforeEach(() => {
  observed = null;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      private rec = {
        cb: null as unknown as Cb,
        target: null as Element | null,
        disconnected: false,
      };
      constructor(cb: Cb) {
        this.rec.cb = cb;
        observed = this.rec;
      }
      observe(el: Element) {
        this.rec.target = el;
      }
      disconnect() {
        this.rec.disconnected = true;
      }
      unobserve() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StickyKpiBar", () => {
  it("lg 이상에서만 붙는다 — 불투명 배경·z-20·top-0, 평소엔 보더가 투명", () => {
    render(
      <StickyKpiBar>
        <p>카드</p>
      </StickyKpiBar>,
    );
    const bar = screen.getByText("카드").parentElement as HTMLElement;
    const t = bar.className.split(/\s+/);
    expect(t).toEqual(
      expect.arrayContaining([
        "lg:sticky",
        "lg:top-0",
        "lg:z-20",
        "bg-paper",
        "border-b",
        "border-transparent",
        "lg:data-[stuck=true]:border-line-soft",
      ]),
    );
    // 폰·태블릿에서는 sticky 가 스크롤 박스에 갇혀 동작하지 않으므로 접두사 없는 sticky 가 없어야 한다
    expect(t).not.toContain("sticky");
    expect(bar).toHaveAttribute("data-stuck", "false");
  });

  it("감시 표식이 화면 밖으로 나가면 붙은 것으로 본다(보더가 나타난다)", () => {
    const { container } = render(
      <StickyKpiBar>
        <p>카드</p>
      </StickyKpiBar>,
    );
    const bar = screen.getByText("카드").parentElement as HTMLElement;
    const sentinel = container.querySelector('[aria-hidden="true"]');
    expect(sentinel).not.toBeNull();
    expect(observed?.target).toBe(sentinel);
    act(() => {
      observed?.cb([{ isIntersecting: false }]);
    });
    expect(bar).toHaveAttribute("data-stuck", "true");
    act(() => {
      observed?.cb([{ isIntersecting: true }]);
    });
    expect(bar).toHaveAttribute("data-stuck", "false");
  });

  it("떠날 때 관찰을 끊는다", () => {
    const { unmount } = render(
      <StickyKpiBar>
        <p>카드</p>
      </StickyKpiBar>,
    );
    unmount();
    expect(observed?.disconnected).toBe(true);
  });

  it("IntersectionObserver 가 없어도 그대로 그린다", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("IntersectionObserver", undefined);
    render(
      <StickyKpiBar>
        <p>카드</p>
      </StickyKpiBar>,
    );
    expect(screen.getByText("카드")).toBeInTheDocument();
  });

  it("마지막 항목이 현재 상태다(같은 대상의 항목이 쌓여도)", () => {
    render(
      <StickyKpiBar>
        <p>카드</p>
      </StickyKpiBar>,
    );
    const bar = screen.getByText("카드").parentElement as HTMLElement;
    act(() => {
      observed?.cb([{ isIntersecting: true }, { isIntersecting: false }]);
    });
    expect(bar).toHaveAttribute("data-stuck", "true");
  });

  describe("자기 높이를 부모(스크롤 컨테이너)의 --ops-kpi-h 로 알린다", () => {
    let roCb: (() => void) | null = null;
    let roDisconnected = false;
    let height = 166;
    beforeEach(() => {
      roCb = null;
      roDisconnected = false;
      height = 166;
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor(cb: () => void) {
            roCb = cb;
          }
          observe() {}
          unobserve() {}
          disconnect() {
            roDisconnected = true;
          }
        },
      );
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
        function (this: Element) {
          return {
            height: this.hasAttribute("data-stuck") ? height : 0,
          } as DOMRect;
        },
      );
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("마운트 때 한 번 재어 쓰고, 크기가 바뀌면 다시 쓴다", () => {
      const { container } = render(
        <StickyKpiBar>
          <p>카드</p>
        </StickyKpiBar>,
      );
      const parent = container as HTMLElement;
      expect(parent.style.getPropertyValue("--ops-kpi-h")).toBe("166px");
      height = 183.4;
      act(() => {
        roCb?.();
      });
      expect(parent.style.getPropertyValue("--ops-kpi-h")).toBe("184px");
    });

    it("떠날 때 변수를 지운다", () => {
      const { container, unmount } = render(
        <StickyKpiBar>
          <p>카드</p>
        </StickyKpiBar>,
      );
      const parent = container as HTMLElement;
      unmount();
      expect(roDisconnected).toBe(true);
      expect(parent.style.getPropertyValue("--ops-kpi-h")).toBe("");
    });

    it("재지 못했으면(0px) 변수를 쓰지 않아 목적지의 기본값(12rem)이 남는다", () => {
      height = 0;
      const { container } = render(
        <StickyKpiBar>
          <p>카드</p>
        </StickyKpiBar>,
      );
      expect((container as HTMLElement).style.getPropertyValue("--ops-kpi-h")).toBe(
        "",
      );
    });
  });
});
