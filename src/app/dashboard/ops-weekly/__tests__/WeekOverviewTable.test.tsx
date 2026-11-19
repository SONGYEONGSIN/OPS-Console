import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
const reopenWeek = vi.fn();
vi.mock("@/features/ops-weekly/workflow-actions", () => ({
  reopenWeek: (...a: unknown[]) => reopenWeek(...a),
}));

import { WeekOverviewTable } from "../_components/WeekOverviewTable";
import { formatMdHm } from "../_format";
import type { WeekOverviewRow } from "@/features/ops-weekly/overview";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const row = (o: Partial<WeekOverviewRow> = {}): WeekOverviewRow => ({
  weekId: "w1",
  weekStart: "2026-11-16",
  label: "L",
  rangeLabel: "R",
  state: { status: "open", dutyEmail: "d@x", reopenedAt: null },
  reportedAt: null,
  submitted: 3,
  total: 9,
  dutyName: "홍길동",
  ...o,
});
const admin = { email: "z@x", isAdmin: true };
const reported = row({
  weekId: "w0",
  weekStart: "2026-11-09",
  state: { status: "reported", dutyEmail: "d@x", reopenedAt: null },
  reportedAt: "2026-11-13T08:05:00Z",
  submitted: 9,
});
const reopened = row({
  weekId: "w2",
  state: { status: "open", dutyEmail: "d@x", reopenedAt: "2026-11-14T01:00:00Z" },
});

describe("WeekOverviewTable", () => {
  it("작업 칸이 주 상태대로 갈린다", () => {
    render(<WeekOverviewTable rows={[row(), reopened, reported]} actor={admin} />);
    const [open, re, rep] = screen.getAllByRole("row").slice(1);
    expect(
      within(open).getByRole("link", { name: "작성자별 보기" }),
    ).toHaveAttribute("href", "/dashboard/ops-weekly?week=2026-11-16&tab=status");
    expect(
      within(re).getByRole("link", { name: "작성자별 보기·고치기" }),
    ).toBeInTheDocument();
    expect(within(rep).getByRole("button", { name: "정정" })).toBeInTheDocument();
    expect(within(rep).getByRole("link", { name: "보기" })).toHaveAttribute(
      "href",
      "/dashboard/ops-weekly?week=2026-11-09&tab=status",
    );
    expect(within(open).queryByRole("button", { name: "정정" })).toBeNull();
  });

  it("상태 문구 — 열림 / 정정으로 열림(vermilion) / 보고 시각(숫자 정렬)", () => {
    render(<WeekOverviewTable rows={[row(), reopened, reported]} actor={admin} />);
    expect(screen.getByText("열림")).toBeInTheDocument();
    expect(screen.getByText("정정으로 열림").className.split(/\s+/)).toContain(
      "text-vermilion",
    );
    const t = screen.getByText(`보고 ${formatMdHm("2026-11-13T08:05:00Z")}`);
    expect(t.className.split(/\s+/)).toContain("tabular-nums");
  });

  it("제출 수는 숫자 정렬, 당번 칸은 행의 이름 그대로(미지정 포함)", () => {
    render(<WeekOverviewTable rows={[row({ dutyName: "미지정" })]} actor={admin} />);
    expect(screen.getByText("3/9").className.split(/\s+/)).toContain(
      "tabular-nums",
    );
    expect(screen.getByText("미지정")).toBeInTheDocument();
  });

  it("[정정] 은 reopenWeek 를 부르고 새로 읽는다", async () => {
    reopenWeek.mockResolvedValue({ ok: true });
    render(<WeekOverviewTable rows={[reported]} actor={admin} />);
    fireEvent.click(screen.getByRole("button", { name: "정정" }));
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(reopenWeek).toHaveBeenCalledTimes(1);
    expect(reopenWeek).toHaveBeenCalledWith({ weekId: "w0" });
  });

  it("정정 권한이 없으면 [정정] 이 없다", () => {
    render(
      <WeekOverviewTable
        rows={[reported]}
        actor={{ email: "q@x", isAdmin: false }}
      />,
    );
    expect(screen.queryByRole("button", { name: "정정" })).toBeNull();
    expect(screen.getByRole("link", { name: "보기" })).toBeInTheDocument();
  });

  it("정정 실패 문구는 role=alert 로 표 위에 뜬다", async () => {
    reopenWeek.mockResolvedValue({ ok: false, error: "정정할 수 없습니다" });
    render(<WeekOverviewTable rows={[reported]} actor={admin} />);
    fireEvent.click(screen.getByRole("button", { name: "정정" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("정정할 수 없습니다");
    expect(alert.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["text-xs", "text-vermilion"]),
    );
  });

  it("행 호버는 목록 표준, 표는 가로 스크롤 래퍼 안", () => {
    render(<WeekOverviewTable rows={[row()]} actor={admin} />);
    const tr = screen.getAllByRole("row")[1];
    expect(tr.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["border-b", "border-line-soft", "hover:bg-line-soft"]),
    );
    expect(screen.getByRole("table").parentElement?.className).toContain(
      "overflow-x-auto",
    );
    expect(screen.getByRole("table").className.split(/\s+/)).toContain(
      "min-w-[40rem]",
    );
  });

  it("행이 없으면 빈 상태 상자", () => {
    render(<WeekOverviewTable rows={[]} actor={admin} />);
    const box = screen
      .getByText("열린 주가 아직 없습니다")
      .closest("div") as Element;
    expect(box.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["bg-situation-bg", "border-line-soft"]),
    );
    expect(screen.queryByRole("table")).toBeNull();
  });
});
