import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";

vi.mock(
  "next/navigation",
  async () => (await import("./search-params-mock")).navigationModule,
);

import { SubTabs } from "../_components/SubTabs";
import { setUrl } from "./search-params-mock";

const tokens = (el: Element) => el.className.split(/\s+/);

const TABS = [
  { key: "dev", label: "개발 중", count: 3 },
  { key: "test", label: "테스트 중", count: null },
  { key: "running", label: "운영 중", count: 0 },
];
const PANELS = {
  dev: <input aria-label="개발 입력" />,
  test: <p>테스트 패널</p>,
  running: <p>운영 패널</p>,
};

function mount() {
  return render(
    <SubTabs
      tab="application"
      ariaLabel="원서접수 묶음"
      tabs={TABS}
      panels={PANELS}
    />,
  );
}

const selected = (name: RegExp) =>
  screen.getByRole("tab", { name }).getAttribute("aria-selected");

beforeEach(() => {
  setUrl("?week=2026-11-16&tab=application");
});
afterEach(cleanup);

describe("SubTabs", () => {
  it("탭 줄은 tablist, 탭은 메일함 범위 칩 모양(글씨 sm·선택은 굵은 잉크+빨간 밑줄), 숫자는 괄호 안 tabular-nums", () => {
    mount();
    const list = screen.getByRole("tablist", { name: "원서접수 묶음" });
    // 넓은 화면에서는 스크롤 상자가 아니다 — 스크롤 상자는 기준선이 상자 아래로 잡혀 제목과 줄이 어긋난다
    expect(tokens(list)).toContain("max-lg:overflow-x-auto");
    expect(tokens(list)).not.toContain("overflow-x-auto");
    const dev = screen.getByRole("tab", { name: /개발 중/ });
    expect(dev).toHaveAttribute("aria-selected", "true");
    expect(dev).toHaveAttribute("tabindex", "0");
    expect(dev).toHaveAttribute("aria-controls", "sub-panel-dev");
    expect(dev).toHaveAttribute("id", "sub-tab-dev");
    expect(tokens(dev)).toEqual(
      expect.arrayContaining([
        "relative",
        "text-sm",
        "font-bold",
        "text-ink",
        "shrink-0",
        "whitespace-nowrap",
      ]),
    );
    expect(dev.textContent).toBe("개발 중 (3)");
    // 선택 밑줄은 빨간 막대
    const bar = dev.querySelector("[aria-hidden]") as HTMLElement;
    expect(tokens(bar)).toEqual(expect.arrayContaining(["h-0.5", "bg-vermilion"]));
    const test = screen.getByRole("tab", { name: /테스트 중/ });
    expect(test).toHaveAttribute("aria-selected", "false");
    expect(test).toHaveAttribute("tabindex", "-1");
    expect(tokens(test)).toEqual(expect.arrayContaining(["text-muted"]));
    expect(test.querySelector("[aria-hidden]")).toBeNull();
    expect(tokens(within(dev).getByText("3"))).toContain("tabular-nums");
    expect(within(test).getByText("—")).toBeInTheDocument();
    expect(
      within(screen.getByRole("tab", { name: /운영 중/ })).getByText("0"),
    ).toBeInTheDocument();
  });

  it("heading 을 주면 탭 줄 왼쪽, 같은 줄에 놓인다", () => {
    render(
      <SubTabs
        tab="application"
        ariaLabel="원서접수 묶음"
        tabs={TABS}
        panels={PANELS}
        heading={<h2>원서접수</h2>}
      />,
    );
    const h = screen.getByRole("heading", { name: "원서접수" });
    const list = screen.getByRole("tablist", { name: "원서접수 묶음" });
    const row = h.parentElement as HTMLElement;
    expect(row.contains(list)).toBe(true);
    expect(tokens(row)).toContain("flex");
    // 제목(text-xl)·건수·탭 글자가 한 기준선 — 가운데 정렬이면 글자 크기가 달라 줄이 어긋난다
    expect(tokens(row)).toContain("items-baseline");
    expect(tokens(row)).not.toContain("items-center");
  });

  it("비활성 패널도 DOM 에 남고 hidden 이다(입력 중인 폼 보존)", () => {
    const { container } = mount();
    const panels = container.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(3);
    expect(panels[0]).not.toHaveAttribute("hidden");
    expect(panels[1]).toHaveAttribute("hidden");
    expect(panels[2]).toHaveAttribute("hidden");
    expect(panels[1]).toHaveAttribute("aria-labelledby", "sub-tab-test");
    expect(screen.getByText("테스트 패널")).toBeInTheDocument();
  });

  it("탭을 누르면 URL 의 sub 만 바뀌고 다른 쿼리는 남는다", () => {
    mount();
    fireEvent.click(screen.getByRole("tab", { name: /테스트 중/ }));
    expect(window.location.search).toContain("sub=test");
    expect(window.location.search).toContain("week=2026-11-16");
    expect(window.location.search).toContain("tab=application");
    expect(selected(/테스트 중/)).toBe("true");
    expect(selected(/개발 중/)).toBe("false");
    expect(
      screen.getByText("테스트 패널").closest("[role=tabpanel]"),
    ).not.toHaveAttribute("hidden");
  });

  it("탭을 오가도 입력 중이던 값이 남는다", () => {
    mount();
    fireEvent.change(screen.getByLabelText("개발 입력"), {
      target: { value: "작성 중" },
    });
    fireEvent.click(screen.getByRole("tab", { name: /운영 중/ }));
    fireEvent.click(screen.getByRole("tab", { name: /개발 중/ }));
    expect((screen.getByLabelText("개발 입력") as HTMLInputElement).value).toBe(
      "작성 중",
    );
  });

  it("URL 의 sub 로 시작하고, 목록 밖이면 기본값", () => {
    setUrl("?sub=running");
    mount();
    expect(selected(/운영 중/)).toBe("true");
    cleanup();
    setUrl("?sub=nope");
    mount();
    expect(selected(/개발 중/)).toBe("true");
  });

  it("목록에 없는 키(안 보이는 탭·다른 탭의 키)는 기본값", () => {
    setUrl("?sub=unknown");
    mount();
    expect(selected(/개발 중/)).toBe("true");
    cleanup();
    setUrl("?sub=nextWeek");
    mount();
    expect(selected(/개발 중/)).toBe("true");
  });

  it("방향키·Home·End 로 이웃 탭을 고르고 포커스가 따라간다", () => {
    mount();
    const dev = screen.getByRole("tab", { name: /개발 중/ });
    dev.focus();
    fireEvent.keyDown(dev, { key: "ArrowRight" });
    const test = screen.getByRole("tab", { name: /테스트 중/ });
    expect(selected(/테스트 중/)).toBe("true");
    expect(document.activeElement).toBe(test);
    fireEvent.keyDown(test, { key: "End" });
    expect(selected(/운영 중/)).toBe("true");
    fireEvent.keyDown(screen.getByRole("tab", { name: /운영 중/ }), {
      key: "ArrowRight",
    });
    expect(selected(/개발 중/)).toBe("true");
    fireEvent.keyDown(screen.getByRole("tab", { name: /개발 중/ }), {
      key: "ArrowLeft",
    });
    expect(selected(/운영 중/)).toBe("true");
    fireEvent.keyDown(screen.getByRole("tab", { name: /운영 중/ }), {
      key: "Home",
    });
    expect(selected(/개발 중/)).toBe("true");
  });

  it("탭 버튼에 배경 호버를 넣지 않는다(밑줄 탭과 같게)", () => {
    mount();
    for (const t of screen.getAllByRole("tab")) {
      expect(t.className).not.toMatch(/hover:bg-/);
    }
  });

  it("접근 이름에 라벨과 숫자 사이 구분이 있다(개발 중 (3))", () => {
    mount();
    expect(screen.getByRole("tab", { name: "개발 중 (3)" })).toBeInTheDocument();
  });

  it("패널은 탭 순서에 든다(tabIndex 0)", () => {
    const { container } = mount();
    for (const p of container.querySelectorAll('[role="tabpanel"]')) {
      expect(p).toHaveAttribute("tabindex", "0");
    }
  });

  it("스크롤 목적지: 고정 KPI 바 높이(--ops-kpi-h)만큼 비켜 선다", () => {
    mount();
    const target = document.getElementById(
      "ops-subtabs-application",
    ) as HTMLElement;
    expect(target.className.split(/\s+/)).toContain(
      "lg:scroll-mt-[calc(var(--ops-kpi-h,12rem)_+_0.5rem)]",
    );
  });

  it("줄 id 는 영역별이다 — 합격자 발표 줄은 ops-subtabs-pims", () => {
    render(
      <SubTabs
        tab="pims"
        ariaLabel="합격자 발표 묶음"
        tabs={[{ key: "thisWeek", label: "금주 발표", count: 1 }]}
        panels={{ thisWeek: null }}
      />,
    );
    expect(document.getElementById("ops-subtabs-pims")).not.toBeNull();
    expect(document.getElementById("ops-subtabs-application")).toBeNull();
  });

  it("defaultKey 로 URL 에 sub 가 없을 때의 기본 탭을 바꾼다", () => {
    render(
      <SubTabs
        tab="application"
        ariaLabel="원서접수 묶음"
        tabs={TABS}
        panels={PANELS}
        defaultKey="running"
      />,
    );
    expect(selected(/운영 중/)).toBe("true");
  });

  describe("활성 탭을 줄 안으로 가로 스크롤한다(페이지는 안 움직인다)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });
    function stubRects() {
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
        function (this: Element) {
          const role = this.getAttribute("role");
          const box = (left: number, right: number) =>
            ({ left, right, top: 0, bottom: 0, width: right - left, height: 0, x: left, y: 0, toJSON() {} }) as DOMRect;
          if (role === "tablist") return box(0, 100);
          if (this.id === "sub-tab-running") return box(150, 250);
          if (this.id === "sub-tab-dev") return box(-60, 40);
          return box(40, 90);
        },
      );
    }
    it("마운트 때 줄 밖 오른쪽에 있는 활성 탭을 끌어온다", () => {
      stubRects();
      setUrl("?sub=running");
      mount();
      expect(screen.getByRole("tablist").scrollLeft).toBe(150);
    });
    it("활성 탭이 바뀌면 다시 맞춘다(왼쪽으로 벗어난 경우도)", () => {
      stubRects();
      setUrl("?sub=running");
      mount();
      const list = screen.getByRole("tablist");
      fireEvent.click(screen.getByRole("tab", { name: /개발 중/ }));
      expect(list.scrollLeft).toBe(90);
    });
    it("scrollIntoView 는 쓰지 않는다 — 페이지가 세로로 움직일 수 있다", () => {
      const spy = vi.fn();
      Element.prototype.scrollIntoView = spy;
      stubRects();
      setUrl("?sub=running");
      mount();
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
