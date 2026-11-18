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
  it("탭 줄은 tablist, 탭은 밑줄 표준 모양, 숫자는 tabular-nums", () => {
    mount();
    const list = screen.getByRole("tablist", { name: "원서접수 묶음" });
    expect(tokens(list)).toContain("overflow-x-auto");
    expect(tokens(list)).toContain("-mb-px");
    expect(tokens(list.parentElement as Element)).toEqual(
      expect.arrayContaining(["border-b", "border-line-soft"]),
    );
    const dev = screen.getByRole("tab", { name: /개발 중/ });
    expect(dev).toHaveAttribute("aria-selected", "true");
    expect(dev).toHaveAttribute("tabindex", "0");
    expect(dev).toHaveAttribute("aria-controls", "sub-panel-dev");
    expect(dev).toHaveAttribute("id", "sub-tab-dev");
    expect(tokens(dev)).toEqual(
      expect.arrayContaining([
        "border-b-2",
        "border-vermilion",
        "font-semibold",
        "text-vermilion",
        "shrink-0",
        "whitespace-nowrap",
        "min-h-9",
        "lg:min-h-0",
      ]),
    );
    const test = screen.getByRole("tab", { name: /테스트 중/ });
    expect(test).toHaveAttribute("aria-selected", "false");
    expect(test).toHaveAttribute("tabindex", "-1");
    expect(tokens(test)).toEqual(
      expect.arrayContaining(["border-transparent", "text-ink-soft"]),
    );
    expect(tokens(test)).not.toContain("border-vermilion");
    expect(tokens(within(dev).getByText("3"))).toContain("tabular-nums");
    expect(tokens(within(test).getByText("—"))).toContain("text-muted");
    expect(
      within(screen.getByRole("tab", { name: /운영 중/ })).getByText("0"),
    ).toBeInTheDocument();
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
});
