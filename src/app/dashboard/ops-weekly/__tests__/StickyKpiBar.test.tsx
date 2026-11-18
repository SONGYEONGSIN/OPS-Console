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
});
