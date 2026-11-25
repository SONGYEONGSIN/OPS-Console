import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { weekRefFromStart } from "@/features/ops-weekly/week";

vi.mock(
  "next/navigation",
  async () => (await import("./search-params-mock")).navigationModule,
);

import { WeekHeaderV2 } from "../_components/WeekHeaderV2";
import { setUrl } from "./search-params-mock";

const weekRef = weekRefFromStart("2026-11-16");
if (!weekRef) throw new Error("fixture");

const base = {
  weekRef,
  showReportState: true,
  thisWeekHref: "/dashboard/ops-weekly-v2?week=2026-11-16&tab=application",
  nextWeekHref: "/dashboard/ops-weekly-v2?week=2026-11-23&tab=application",
  current: "this" as "this" | "next" | null,
};

const tokens = (el: Element) => el.className.split(/\s+/);

beforeEach(() => {
  setUrl("?week=2026-11-16&tab=application");
});

describe("WeekHeaderV2", () => {
  it("운영리포트처럼 — 제목 주간업무보고, 그 아래 이번 주 일정", () => {
    render(<WeekHeaderV2 {...base} />);
    const h = screen.getByRole("heading", { name: "주간업무보고" });
    expect(tokens(h)).toEqual(
      expect.arrayContaining(["text-xl", "font-bold", "text-ink"]),
    );
    const sched = screen.getByText("2026년 11월 3주차 · 11/16~11/20");
    expect(tokens(sched)).toEqual(
      expect.arrayContaining(["text-xs", "text-muted", "tabular-nums"]),
    );
    expect(h.parentElement).toBe(sched.parentElement);
  });

  it("오른쪽엔 이번 주·다음 주 버튼뿐 — 보는 주가 켜진다(운영리포트 기간 버튼 모양)", () => {
    render(<WeekHeaderV2 {...base} />);
    const group = screen.getByRole("group", { name: "주 선택" });
    const links = Array.from(group.querySelectorAll("a"));
    expect(links.map((l) => l.textContent)).toEqual(["이번 주", "다음 주"]);
    const [thisW, nextW] = links;
    expect(thisW).toHaveAttribute("href", base.thisWeekHref);
    expect(nextW).toHaveAttribute("href", base.nextWeekHref);
    expect(thisW).toHaveAttribute("aria-current", "page");
    expect(tokens(thisW)).toEqual(
      expect.arrayContaining(["border-vermilion", "bg-vermilion", "text-cream"]),
    );
    expect(nextW).not.toHaveAttribute("aria-current");
    expect(tokens(nextW)).toEqual(
      expect.arrayContaining(["border-line", "hover:bg-ink", "hover:text-cream"]),
    );
  });

  it("다른 주를 보는 중이면 둘 다 꺼진다", () => {
    render(<WeekHeaderV2 {...base} current={null} />);
    const group = screen.getByRole("group", { name: "주 선택" });
    expect(group.querySelector("[aria-current]")).toBeNull();
  });

  it("머리는 제목·일정·주 버튼뿐 — 내/전체 보고서 토글·제출·당번·안내 줄이 없다(2026-11-25 사용자 지시)", () => {
    render(<WeekHeaderV2 {...base} />);
    expect(screen.queryByRole("link", { name: "전체 보고서" })).toBeNull();
    expect(screen.queryByText("내 보고서")).toBeNull();
    expect(screen.queryByText(/^제출 \d+\/\d+$/)).toBeNull();
    expect(screen.queryByText(/^당번 /)).toBeNull();
    expect(screen.queryByText(/지난주 보고가/)).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("내 보고서에서 주 버튼은 지금 영역(URL)을 따라간다", () => {
    setUrl("?week=2026-11-16&tab=pims");
    render(<WeekHeaderV2 {...base} />);
    const next = screen.getByRole("link", { name: "다음 주" });
    expect(next.getAttribute("href")).toContain("tab=pims");
    expect(next.getAttribute("href")).toContain("week=2026-11-23");
    cleanup();
    render(<WeekHeaderV2 {...base} showReportState={false} />);
    expect(screen.getByRole("link", { name: "다음 주" })).toHaveAttribute(
      "href",
      base.nextWeekHref,
    );
  });
});
