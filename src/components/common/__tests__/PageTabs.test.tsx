import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageTabs } from "../PageTabs";

const tabs = [
  { key: "univ", label: "대학배정", href: "/dashboard/assignments?tab=univ" },
  { key: "duties", label: "업무분장", href: "/dashboard/assignments?tab=duties" },
  { key: "pricing", label: "가격정책", href: "/dashboard/assignments?tab=pricing" },
];

const tokens = (el: HTMLElement) => el.className.split(/\s+/);

describe("PageTabs", () => {
  it("모든 탭 라벨을 href 링크로 렌더", () => {
    render(<PageTabs active="univ" tabs={tabs} />);
    const univ = screen.getByRole("link", { name: "대학배정" });
    expect(univ).toHaveAttribute("href", "/dashboard/assignments?tab=univ");
    expect(screen.getByRole("link", { name: "업무분장" })).toHaveAttribute(
      "href",
      "/dashboard/assignments?tab=duties",
    );
    expect(screen.getByRole("link", { name: "가격정책" })).toBeInTheDocument();
  });

  it("활성 탭만 aria-current='page'", () => {
    render(<PageTabs active="duties" tabs={tabs} />);
    expect(screen.getByRole("link", { name: "업무분장" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "대학배정" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("기본 모양 — 한 줄 밑줄 탭 (text-sm, px-4 py-2)", () => {
    render(<PageTabs active="univ" tabs={tabs} />);
    const active = screen.getByRole("link", { name: "대학배정" });
    const idle = screen.getByRole("link", { name: "업무분장" });
    for (const c of ["px-4", "py-2", "text-sm"]) {
      expect(active.className).toContain(c);
    }
    for (const c of ["border-vermilion", "font-semibold", "text-vermilion"]) {
      expect(active.className).toContain(c);
    }
    expect(idle.className).toContain("text-ink-soft");
    expect(idle.className).toContain("border-transparent");
    expect(active.className).not.toContain("text-xs");
    const bar = tokens(active.parentElement!.parentElement!);
    expect(bar).toContain("border-line");
    expect(bar).not.toContain("border-line-soft");
    expect(bar).not.toContain("mt-3");
  });

  it('size="sm" — 메인보다 작고 가벼운 서브 탭 (칩 아님)', () => {
    render(<PageTabs active="univ" tabs={tabs} size="sm" />);
    const active = screen.getByRole("link", { name: "대학배정" });
    const idle = screen.getByRole("link", { name: "업무분장" });
    for (const c of ["text-xs", "px-3", "py-2"]) {
      expect(tokens(active)).toContain(c);
    }
    // 메인 탭 바로 밑에 붙어 납작해 보였다(사용자 지시 2026-11-05).
    expect(tokens(active)).not.toContain("py-1.5");
    for (const c of ["border-b-2", "border-vermilion", "text-vermilion"]) {
      expect(active.className).toContain(c);
    }
    expect(active.className).not.toContain("text-sm");
    expect(active.className).not.toContain("px-4");
    expect(active.className).not.toContain("rounded");
    expect(active.className).not.toContain("bg-");
    expect(idle.className).toContain("text-ink-soft");
    expect(idle.className).toContain("border-transparent");
    const bar = tokens(active.parentElement!.parentElement!);
    expect(bar).toContain("border-b");
    expect(bar).toContain("border-line-soft");
    expect(bar).not.toContain("border-line");
    // 메인 탭 줄과 띄운다.
    expect(bar).toContain("mt-3");
    expect(active).toHaveAttribute("aria-current", "page");
  });

  it("좁은 화면에서는 가로 스크롤, 탭은 줄어들지 않는다", () => {
    render(<PageTabs active="univ" tabs={tabs} />);
    const link = screen.getByRole("link", { name: "대학배정" });
    const row = link.parentElement!;
    // 회색 줄은 래퍼가, 겹침(-mb-px)과 스크롤은 줄이 맡는다 — 데스크톱 모양은 그대로.
    expect(tokens(row.parentElement!)).toContain("border-b");
    expect(tokens(row)).toContain("overflow-x-auto");
    expect(tokens(row)).toContain("-mb-px");
    expect(tokens(link)).not.toContain("-mb-px");
    for (const c of ["whitespace-nowrap", "shrink-0"]) {
      expect(tokens(link)).toContain(c);
    }
  });

  it("바깥 패딩은 기본 px-7, className 으로 바꾼다", () => {
    const { container, rerender } = render(
      <PageTabs active="univ" tabs={tabs} />,
    );
    expect(tokens(container.firstElementChild as HTMLElement)).toContain(
      "px-7",
    );
    rerender(<PageTabs active="univ" tabs={tabs} className="px-5 lg:px-7" />);
    const outer = tokens(container.firstElementChild as HTMLElement);
    expect(outer).toContain("px-5");
    expect(outer).toContain("lg:px-7");
    expect(outer).not.toContain("px-7 ");
  });
});
