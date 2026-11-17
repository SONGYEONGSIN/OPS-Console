import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { HEADER_ACTION_CLASS } from "@/components/common/HeaderActionButton";
import { weekRefFromStart } from "@/features/ops-weekly/week";
import type { WeekRow } from "@/features/ops-weekly/schemas";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));
const submitReport = vi.fn();
vi.mock("@/features/ops-weekly/workflow-actions", () => ({
  submitReport: (...a: unknown[]) => submitReport(...a),
}));

import { WeekHeader } from "../_components/WeekHeader";

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
  viewedName: "운영자A",
  writers: [
    { email: "a@example.com", name: "운영자A" },
    { email: "b@example.com", name: "운영자B" },
  ],
  viewedEmail: "a@example.com",
  submittedCount: 0,
  writerCount: 2,
  dutyName: null,
  canSubmit: false,
  reportStatus: "draft" as const,
  submittedAt: null,
  reportId: "r1",
  prevOpen: false,
  prevHref: "/dashboard/ops-weekly?week=2026-11-09",
  nextHref: "/dashboard/ops-weekly?week=2026-11-23",
  tab: "application",
};

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  submitReport.mockReset();
});

describe("WeekHeader", () => {
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

  it("제출 버튼은 본인·열린 주에만, 표준 헤더 액션 모양", () => {
    render(<WeekHeader {...base} canSubmit />);
    expect(
      screen.getByRole("button", { name: "제출완료" }).className,
    ).toContain(HEADER_ACTION_CLASS);
    cleanup();
    render(<WeekHeader {...base} canSubmit={false} />);
    expect(screen.queryByRole("button", { name: "제출완료" })).toBeNull();
  });

  it("이미 제출했으면 버튼 대신 제출 시각", () => {
    render(
      <WeekHeader
        {...base}
        reportStatus="submitted"
        submittedAt="2026-11-19T08:05:00Z"
      />,
    );
    expect(screen.queryByRole("button", { name: "제출완료" })).toBeNull();
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

  it("‹ › 주 이동 링크", () => {
    render(<WeekHeader {...base} />);
    expect(screen.getByRole("link", { name: "이전 주" })).toHaveAttribute(
      "href",
      base.prevHref,
    );
    expect(screen.getByRole("link", { name: "다음 주" })).toHaveAttribute(
      "href",
      base.nextHref,
    );
  });

  it("작성자를 바꾸면 op 를 달아 같은 탭으로 이동", () => {
    render(<WeekHeader {...base} />);
    fireEvent.change(screen.getByLabelText("작성자"), {
      target: { value: "운영자B" },
    });
    expect(push).toHaveBeenCalledWith(
      "/dashboard/ops-weekly?week=2026-11-16&tab=application&op=b%40example.com",
    );
  });

  it("제출 성공 → 새로고침", async () => {
    submitReport.mockResolvedValue({ ok: true });
    render(<WeekHeader {...base} canSubmit />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(submitReport).toHaveBeenCalledWith({ reportId: "r1" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("제출은 끝났지만 후속 실패 → 새로고침하고 그 문구를 실패로 포장하지 않는다", async () => {
    submitReport.mockResolvedValue({
      ok: false,
      error: "제출은 끝났지만 전원 제출 확인에 실패했습니다: x",
    });
    render(<WeekHeader {...base} canSubmit />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(
      screen.getByText("제출은 끝났지만 전원 제출 확인에 실패했습니다: x"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/제출에 실패/)).toBeNull();
  });

  it("제출은 끝났지만 안내는 새로고침으로 제출 상태 props 가 와도 사라지지 않는다", async () => {
    const msg = "제출은 끝났지만 전원 제출 확인에 실패했습니다: x";
    submitReport.mockResolvedValue({ ok: false, error: msg });
    const { rerender } = render(<WeekHeader {...base} canSubmit />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    rerender(
      <WeekHeader
        {...base}
        canSubmit={false}
        reportStatus="submitted"
        submittedAt="2026-11-19T08:05:00Z"
      />,
    );
    expect(screen.getByText("제출함 11/19 17:05")).toBeInTheDocument();
    expect(screen.getByText(msg)).toBeInTheDocument();
  });

  it("진짜 제출 실패도 새로고침해 낡은 화면을 바로잡는다", async () => {
    submitReport.mockResolvedValue({
      ok: false,
      error: "이미 제출한 보고서입니다.",
    });
    render(<WeekHeader {...base} canSubmit />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "이미 제출한 보고서입니다.",
    );
  });

  it("제출 action 이 던져도 페이지를 날리지 않고 안내 + 새로고침", async () => {
    submitReport.mockRejectedValue(new Error("명단 조회 실패"));
    render(<WeekHeader {...base} canSubmit />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "제출하지 못했습니다 — 잠시 후 다시 시도하세요",
    );
    expect(screen.queryByText(/명단 조회 실패/)).toBeNull();
  });
  describe("가독성 — 머리줄 모양", () => {
    const tokens = (el: Element) => el.className.split(/\s+/);
    const climb = (el: Element, token: string): Element | null => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        if (tokens(n).includes(token)) return n;
      }
      return null;
    };

    it("정보는 왼쪽 · 액션은 오른쪽 묶음, 그 부모 행이 양 끝 정렬", () => {
      render(<WeekHeader {...base} canSubmit />);
      const button = screen.getByRole("button", { name: "제출완료" });
      const right = climb(button, "justify-end");
      expect(right).not.toBeNull();
      expect(tokens(right?.parentElement as Element)).toContain(
        "justify-between",
      );
      expect(right?.contains(screen.getByLabelText("작성자"))).toBe(false);
    });

    it("제출 실패 메시지는 머리 행 밖 아래 줄에서 vermilion 으로", async () => {
      submitReport.mockResolvedValue({ ok: false, error: "이미 제출함" });
      render(<WeekHeader {...base} canSubmit />);
      const button = screen.getByRole("button", { name: "제출완료" });
      fireEvent.click(button);
      const alert = await screen.findByRole("alert");
      expect(tokens(alert)).toContain("text-vermilion");
      expect(alert.parentElement).not.toBe(button.parentElement);
      expect(climb(button, "justify-end")?.contains(alert)).toBe(false);
      expect(
        button.compareDocumentPosition(alert) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("상태 배지 — 작성 중 / 제출함(숫자 정렬) / 다시 작성 요청(vermilion)", () => {
      const { rerender } = render(<WeekHeader {...base} />);
      expect(screen.getByText("작성 중")).toBeInTheDocument();
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

    it("주 이동 링크는 터치 폭 36px 이상", () => {
      render(<WeekHeader {...base} />);
      const t = tokens(screen.getByRole("link", { name: "이전 주" }));
      expect(t).toContain("min-h-9");
      expect(t).toContain("min-w-9");
    });
  });
});
