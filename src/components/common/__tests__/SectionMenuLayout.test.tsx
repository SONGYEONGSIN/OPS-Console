import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { SectionMenuLayout } from "../SectionMenuLayout";

const items = [
  { key: "a", label: "전체 현황" },
  { key: "b", label: "안 붙은 서비스", badge: 3 },
  { key: "c", label: "비어 있음", badge: 0 },
] as const;
const view = (onSelect = vi.fn()) =>
  render(
    <SectionMenuLayout ariaLabel="관리 메뉴" items={items} active="a" onSelect={onSelect}>
      <p>내용</p>
    </SectionMenuLayout>,
  );
const tokens = (el: Element) => el.className.split(/\s+/);

describe("SectionMenuLayout", () => {
  it("md 이상 240px 왼쪽 메뉴 + 오른쪽 내용, md 미만은 위로 쌓인 가로 줄", () => {
    const { container } = view();
    expect(tokens(container.firstElementChild as Element)).toEqual(
      expect.arrayContaining(["grid", "grid-cols-1", "md:grid-cols-[240px_1fr]"]),
    );
    expect(tokens(screen.getByRole("navigation", { name: "관리 메뉴" }))).toEqual(
      expect.arrayContaining(["max-md:flex-row", "max-md:overflow-x-auto"]),
    );
  });

  it("md 이상에서 왼쪽 메뉴는 붙어 있고 오른쪽 내용만 스크롤된다 — 세로선은 칸 전체 높이", () => {
    view();
    const nav = screen.getByRole("navigation", { name: "관리 메뉴" });
    expect(tokens(nav)).toEqual(expect.arrayContaining(["md:sticky", "md:top-4"]));
    // 메뉴가 짧아져도 세로선은 오른쪽 내용 높이만큼 — 선은 늘어나는 바깥 칸이 긋는다
    expect(tokens(nav.parentElement as Element)).toEqual(
      expect.arrayContaining(["md:border-r", "border-line"]),
    );
  });

  it("선택 항목은 목록 선택 표준, 나머지는 hover:bg-line-soft", () => {
    view();
    const on = screen.getByRole("button", { name: /전체 현황/ });
    expect(on).toHaveAttribute("aria-pressed", "true");
    expect(tokens(on)).toEqual(
      expect.arrayContaining(["border-vermilion", "bg-vermilion/10", "text-vermilion"]),
    );
    const off = screen.getByRole("button", { name: /안 붙은 서비스/ });
    expect(tokens(off)).toContain("hover:bg-line-soft");
    expect(tokens(off)).not.toContain("bg-vermilion/10");
    expect(tokens(off)).toEqual(
      expect.arrayContaining(["max-md:shrink-0", "max-md:whitespace-nowrap"]),
    );
  });

  it("선택 표식(◉/·)은 장식이라 aria-hidden", () => {
    view();
    const on = within(screen.getByRole("button", { name: /전체 현황/ })).getByText("◉");
    expect(on).toHaveAttribute("aria-hidden", "true");
    const off = within(screen.getByRole("button", { name: /안 붙은 서비스/ })).getByText("·");
    expect(off).toHaveAttribute("aria-hidden", "true");
  });

  it("배지는 이름 뒤 숫자 정렬", () => {
    view();
    const badge = within(screen.getByRole("button", { name: /안 붙은 서비스/ })).getByText("3");
    expect(tokens(badge)).toEqual(expect.arrayContaining(["ml-auto", "text-xs", "tabular-nums"]));
  });

  it("badge 0 도 같은 배지 클래스로 보여 주고, badge 없으면 그리지 않는다", () => {
    view();
    const zero = within(screen.getByRole("button", { name: /비어 있음/ })).getByText("0");
    expect(tokens(zero)).toEqual(expect.arrayContaining(["ml-auto", "text-xs", "tabular-nums"]));
    const none = screen.getByRole("button", { name: /전체 현황/ });
    expect(within(none).queryByText(/^\d+$/)).toBeNull();
  });

  it("누르면 onSelect(key), 내용은 오른쪽 칸에", () => {
    const onSelect = vi.fn();
    view(onSelect);
    fireEvent.click(screen.getByRole("button", { name: /안 붙은 서비스/ }));
    expect(onSelect).toHaveBeenCalledWith("b");
    const content = screen.getByText("내용").parentElement as Element;
    expect(tokens(content)).toEqual(expect.arrayContaining(["flex", "min-w-0", "flex-col", "gap-4"]));
  });
});
