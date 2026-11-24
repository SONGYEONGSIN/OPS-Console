import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { weekRefFromStart } from "@/features/ops-weekly/week";
import type { WeekRow } from "@/features/ops-weekly/schemas";

const push = vi.fn();
vi.mock("next/navigation", async () => ({
  ...(await import("./search-params-mock")).navigationModule,
  useRouter: () => ({ push }),
}));

import { WeekHeaderV2 as WeekHeader } from "../_components/WeekHeaderV2";
import { setUrl } from "./search-params-mock";

const WEEK: WeekRow = {
  id: "w1",
  week_start: "2026-11-16",
  label_year: 2026,
  label_month: 11,
  label_week: 3,
  duty_email: null,
  summary_this: "",
  summary_next: "",
  status: "open",
  reported_at: null,
  reported_by: null,
  reopened_at: null,
  reopened_by: null,
};
const weekRef = weekRefFromStart("2026-11-16");
if (!weekRef) throw new Error("fixture");

const base = {
  weekRef,
  week: WEEK,
  showReportState: true,
  scope: { mine: true, mineOp: null, active: "mine" } as {
    mine: boolean;
    mineOp: string | null;
    active: "mine" | "all" | null;
  } | null,
  submittedCount: 0,
  writerCount: 2,
  dutyName: null,
  reportStatus: "draft" as const,
  submittedAt: null,
  prevOpen: false,
  prevHref: "/dashboard/ops-weekly?week=2026-11-09&tab=application",
  thisWeekHref: "/dashboard/ops-weekly?week=2026-11-16&tab=application",
  nextWeekHref: "/dashboard/ops-weekly?week=2026-11-23&tab=application",
  current: "this" as "this" | "next" | null,
};

const tokens = (el: Element) => el.className.split(/\s+/);

beforeEach(() => {
  push.mockReset();
  setUrl("?week=2026-11-16&tab=application");
});

describe("WeekHeaderV2", () => {
  it("주차·기간·제출 현황·당번을 한 줄에", () => {
    render(
      <WeekHeader
        {...base}
        submittedCount={9}
        writerCount={15}
        dutyName="운영자D"
      />,
    );
    expect(
      screen.getByText("2026년 11월 3주차 · 11/16~11/20"),
    ).toBeInTheDocument();
    expect(screen.getByText("제출 9/15")).toBeInTheDocument();
    expect(screen.getByText("당번 운영자D")).toBeInTheDocument();
  });

  it("당번이 없으면 미지정", () => {
    render(<WeekHeader {...base} />);
    expect(screen.getByText("당번 미지정")).toBeInTheDocument();
  });

  it("머리띠에는 제출 버튼이 없다", () => {
    render(<WeekHeader {...base} />);
    expect(screen.queryByRole("button", { name: "제출완료" })).toBeNull();
  });

  it("이미 제출했으면 제출 시각 배지", () => {
    render(
      <WeekHeader
        {...base}
        reportStatus="submitted"
        submittedAt="2026-11-19T08:05:00Z"
      />,
    );
    expect(screen.getByText("제출함 11/19 17:05")).toBeInTheDocument();
  });

  it("보고된 주는 잠김 줄을 KST 24시간제로", () => {
    render(
      <WeekHeader
        {...base}
        week={{
          ...WEEK,
          status: "reported",
          reported_at: "2026-11-19T08:05:00Z",
        }}
      />,
    );
    expect(
      screen.getByText("11/19 17:05 최종 보고 — 잠김"),
    ).toBeInTheDocument();
  });

  it("지난주 보고가 안 끝났으면 안내 + 지난주로 링크", () => {
    render(<WeekHeader {...base} prevOpen />);
    expect(
      screen.getByText("지난주 보고가 아직 끝나지 않았습니다"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "지난주로" })).toHaveAttribute(
      "href",
      base.prevHref,
    );
  });

  it("운영리포트처럼 — 제목 주간업무보고, 그 아래 이번 주 일정", () => {
    render(<WeekHeader {...base} />);
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
    render(<WeekHeader {...base} />);
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
    expect(screen.queryByRole("link", { name: "이전 주" })).toBeNull();
  });

  it("다른 주를 보는 중이면 둘 다 꺼진다", () => {
    render(<WeekHeader {...base} current={null} />);
    const group = screen.getByRole("group", { name: "주 선택" });
    expect(group.querySelector("[aria-current]")).toBeNull();
  });

  it("내 보고 | 전체 보고 — 지금 영역으로 가는 링크, 전체는 op=all", () => {
    setUrl("?week=2026-11-16&tab=pims");
    render(<WeekHeader {...base} />);
    const mine = screen.getByRole("link", { name: "내 보고서" });
    const all = screen.getByRole("link", { name: "전체 보고서" });
    expect(mine).toHaveAttribute(
      "href",
      "/dashboard/ops-weekly?week=2026-11-16&tab=pims",
    );
    expect(all).toHaveAttribute(
      "href",
      "/dashboard/ops-weekly?week=2026-11-16&tab=pims&op=all",
    );
    expect(mine).toHaveAttribute("aria-current", "page");
    expect(all).not.toHaveAttribute("aria-current");
    expect(screen.queryByLabelText("작성자")).toBeNull();
  });

  it("제출 현황에서 누르면 원서접수로 간다", () => {
    setUrl("?week=2026-11-16&tab=status");
    render(<WeekHeader {...base} showReportState={false} />);
    expect(screen.getByRole("link", { name: "전체 보고서" })).toHaveAttribute(
      "href",
      "/dashboard/ops-weekly?week=2026-11-16&tab=application&op=all",
    );
  });

  it("전체 보고 중이면 전체가 켜지고, 작성자가 아니면 내 보고서는 누를 수 없는 칸으로 남는다", () => {
    render(
      <WeekHeader
        {...base}
        scope={{ mine: false, mineOp: "me", active: "all" }}
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
  });

  it("관리자·당번(mineOp=me)의 내 보고서 링크는 op=me 를 단다 — 기본이 전체 보고라서", () => {
    setUrl("?week=2026-11-16&tab=pims");
    render(
      <WeekHeader
        {...base}
        scope={{ mine: true, mineOp: "me", active: "all" }}
      />,
    );
    expect(screen.getByRole("link", { name: "내 보고서" })).toHaveAttribute(
      "href",
      "/dashboard/ops-weekly?week=2026-11-16&tab=pims&op=me",
    );
  });

  it("scope 가 없으면 토글이 없다", () => {
    render(<WeekHeader {...base} scope={null} />);
    expect(screen.queryByRole("link", { name: "전체 보고서" })).toBeNull();
  });

  it("전체 보고 중에는 내 상태 배지·확인 수가 없고 제출·당번은 있다", () => {
    render(
      <WeekHeader
        {...base}
        scope={{ mine: true, mineOp: null, active: "all" }}
      />,
    );
    expect(screen.queryByText("작성 중")).toBeNull();
    expect(screen.queryByText(/^확인 \d\/5$/)).toBeNull();
    expect(screen.getByText("제출 0/2")).toBeInTheDocument();
  });

  it("내 보고서: 상태 배지는 있고 확인 n/5 는 없다(영역 확인 절차가 없다)", () => {
    render(<WeekHeader {...base} showReportState reportStatus="draft" />);
    expect(screen.getByText("작성 중")).toBeInTheDocument();
    expect(screen.queryByText(/^확인 \d\/5$/)).toBeNull();
  });

  it("제출 현황·관리에서는 배지·확인 수가 없다", () => {
    render(
      <WeekHeader
        {...base}
        showReportState={false}
        reportStatus="draft"
      />,
    );
    expect(screen.queryByText("작성 중")).toBeNull();
    expect(screen.queryByText(/^확인 \d\/5$/)).toBeNull();
    // 제출 수·당번은 아래 표가 이미 보여 준다
    expect(screen.queryByText(/^제출 \d+\/\d+$/)).toBeNull();
    expect(screen.queryByText(/^당번 /)).toBeNull();
  });

  it("내 보고서에서 주 버튼은 지금 영역(URL)을 따라간다 — week·op 순서 유지", () => {
    setUrl("?week=2026-11-16&tab=pims");
    render(<WeekHeader {...base} />);
    const next = screen.getByRole("link", { name: "다음 주" });
    expect(next.getAttribute("href")).toContain("tab=pims");
    expect(next.getAttribute("href")).toContain("week=2026-11-23");
    cleanup();
    setUrl("?week=2026-11-16&tab=project");
    render(
      <WeekHeader
        {...base}
        nextWeekHref="/dashboard/ops-weekly?week=2026-11-23&tab=project&op=b%40example.com"
      />,
    );
    expect(
      screen.getByRole("link", { name: "다음 주" }).getAttribute("href"),
    ).toBe(
      "/dashboard/ops-weekly?week=2026-11-23&tab=project&op=b%40example.com",
    );
  });

  it("제출 현황·관리(showReportState 없음)에서는 링크를 그대로 둔다", () => {
    setUrl("?week=2026-11-16&tab=pims");
    render(<WeekHeader {...base} showReportState={false} />);
    expect(screen.getByRole("link", { name: "다음 주" })).toHaveAttribute(
      "href",
      base.nextWeekHref,
    );
  });

  describe("가독성 — 머리줄 모양", () => {
    const climb = (el: Element, token: string): Element | null => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        if (tokens(n).includes(token)) return n;
      }
      return null;
    };

    it("정보는 왼쪽 · 상태는 오른쪽 묶음, 그 부모 행이 양 끝 정렬", () => {
      render(<WeekHeader {...base} />);
      const right = climb(screen.getByText("제출 0/2"), "justify-end");
      expect(right).not.toBeNull();
      expect(tokens(right?.parentElement as Element)).toContain(
        "justify-between",
      );
      expect(
        right?.contains(screen.getByRole("link", { name: "전체 보고서" })),
      ).toBe(false);
    });

    it("상태 배지 — 작성 중(빨간 바탕) / 제출함(숫자 정렬) / 다시 작성 요청(vermilion)", () => {
      const { rerender } = render(<WeekHeader {...base} />);
      const draft = screen.getByText("작성 중");
      // 작성 중은 빨간 바탕 + 흰 글씨(채운 배지)
      expect(tokens(draft)).toEqual(
        expect.arrayContaining(["border-vermilion", "bg-vermilion", "text-cream"]),
      );
      rerender(
        <WeekHeader
          {...base}
          reportStatus="submitted"
          submittedAt="2026-11-19T08:05:00Z"
        />,
      );
      expect(tokens(screen.getByText("제출함 11/19 17:05"))).toContain(
        "tabular-nums",
      );
      rerender(<WeekHeader {...base} reportStatus="returned" />);
      const badge = screen.getByText("다시 작성 요청");
      expect(tokens(badge)).toContain("border-vermilion");
      expect(tokens(badge)).toContain("text-vermilion");
    });

    it("다시 작성 사유를 메시지 줄에 보여 준다", () => {
      render(
        <WeekHeader
          {...base}
          reportStatus="returned"
          returnReason="사진 누락"
        />,
      );
      expect(
        screen.getByText("다시 작성 요청 — 사진 누락"),
      ).toBeInTheDocument();
    });

    it("내 보고 | 전체 보고 토글 칸은 오늘 할 일 MineScopeToggle 과 같은 px-3 py-1 text-xs", () => {
      render(<WeekHeader {...base} />);
      const seg = tokens(screen.getByRole("link", { name: "전체 보고서" }));
      expect(seg).toEqual(expect.arrayContaining(["px-3", "py-1", "text-xs"]));
    });
  });
});
