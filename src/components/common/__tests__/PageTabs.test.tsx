import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageTabs } from "../PageTabs";

const tabs = [
  { key: "univ", label: "대학배정", href: "/dashboard/assignments?tab=univ" },
  { key: "duties", label: "업무분장", href: "/dashboard/assignments?tab=duties" },
  { key: "pricing", label: "가격정책", href: "/dashboard/assignments?tab=pricing" },
];

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
    for (const c of ["-mb-px", "px-4", "py-2", "text-sm"]) {
      expect(active.className).toContain(c);
    }
    for (const c of ["border-vermilion", "font-semibold", "text-vermilion"]) {
      expect(active.className).toContain(c);
    }
    expect(idle.className).toContain("text-ink-soft");
    expect(idle.className).toContain("border-transparent");
    expect(active.className).not.toContain("text-xs");
    expect(active.parentElement!.className).toContain("border-line");
  });

  it('size="sm" — 메인보다 작고 가벼운 서브 탭 (칩 아님)', () => {
    render(<PageTabs active="univ" tabs={tabs} size="sm" />);
    const active = screen.getByRole("link", { name: "대학배정" });
    const idle = screen.getByRole("link", { name: "업무분장" });
    for (const c of ["text-xs", "px-3", "py-1.5", "-mb-px"]) {
      expect(active.className).toContain(c);
    }
    for (const c of ["border-b-2", "border-vermilion", "text-vermilion"]) {
      expect(active.className).toContain(c);
    }
    expect(active.className).not.toContain("text-sm");
    expect(active.className).not.toContain("px-4");
    expect(active.className).not.toContain("rounded");
    expect(active.className).not.toContain("bg-");
    expect(idle.className).toContain("text-ink-soft");
    expect(idle.className).toContain("border-transparent");
    expect(active.parentElement!.className).toContain("border-b");
    expect(active).toHaveAttribute("aria-current", "page");
  });
});
