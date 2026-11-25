import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { weekRefFromStart } from "@/features/ops-weekly/week";

vi.mock(
  "next/navigation",
  async () => (await import("./search-params-mock")).navigationModule,
);

import { WeekHeaderV2 } from "../_components/WeekHeaderV2";
import { OpsPathProvider } from "../_components/ops-path";
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

const scope = {
  mine: true,
  mineOp: null as string | null,
  active: "mine" as "mine" | "all" | null,
  weekStart: "2026-11-16",
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
      expect.arrayContaining([
        "border-line",
        "hover:border-vermilion",
        "hover:bg-vermilion/10",
        "hover:text-vermilion",
      ]),
    );
  });

  it("다른 주를 보는 중이면 둘 다 꺼진다", () => {
    render(<WeekHeaderV2 {...base} current={null} />);
    const group = screen.getByRole("group", { name: "주 선택" });
    expect(group.querySelector("[aria-current]")).toBeNull();
  });

  it("제출·당번·안내 줄은 없다(2026-11-25 사용자 지시)", () => {
    render(<WeekHeaderV2 {...base} />);
    expect(screen.queryByText(/^제출 \d+\/\d+$/)).toBeNull();
    expect(screen.queryByText(/^당번 /)).toBeNull();
    expect(screen.queryByText(/지난주 보고가/)).toBeNull();
  });

  it("주 버튼 왼쪽에 내 보고서·전체 보고서 — 켜진 칸은 검정, 꺼진 칸 호버는 검정 음영", () => {
    render(
      <OpsPathProvider path="/dashboard/ops-weekly-v2">
        <WeekHeaderV2 {...base} scope={scope} />
      </OpsPathProvider>,
    );
    const group = screen.getByRole("group", { name: "보고서 범위" });
    const links = Array.from(group.querySelectorAll("a"));
    expect(links.map((l) => l.textContent)).toEqual([
      "내 보고서",
      "전체 보고서",
    ]);
    const [mine, all] = links;
    expect(mine).toHaveAttribute("aria-current", "page");
    expect(tokens(mine)).toEqual(
      expect.arrayContaining(["border-ink", "bg-ink", "text-cream"]),
    );
    expect(all).not.toHaveAttribute("aria-current");
    expect(tokens(all)).toEqual(
      expect.arrayContaining([
        "border-line",
        "hover:border-ink",
        "hover:bg-ink/10",
      ]),
    );
    expect(all.getAttribute("href")).toContain("op=all");
    expect(all.getAttribute("href")).toContain("week=2026-11-16");
    expect(all.getAttribute("href")).toContain("tab=application");
    expect(
      all.getAttribute("href")?.startsWith("/dashboard/ops-weekly-v2?"),
    ).toBe(true);
    // 범위 묶음이 주 묶음보다 앞(왼쪽)이다
    const weeks = screen.getByRole("group", { name: "주 선택" });
    expect(
      group.compareDocumentPosition(weeks) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("작성 대상이 아니면 내 보고서 칸은 비활성, scope 가 없으면 토글을 안 그린다", () => {
    render(
      <WeekHeaderV2
        {...base}
        scope={{ ...scope, mine: false, active: "all" }}
      />,
    );
    expect(screen.queryByRole("link", { name: "내 보고서" })).toBeNull();
    expect(screen.getByText("내 보고서")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("link", { name: "전체 보고서" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    cleanup();
    render(<WeekHeaderV2 {...base} />);
    expect(screen.queryByRole("group", { name: "보고서 범위" })).toBeNull();
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
