import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  usePathname: () => "/dashboard/schedule",
  useSearchParams: () => new URLSearchParams(),
}));

import { CalendarView } from "../CalendarView";
import type { ScheduleEventRow } from "@/features/schedule/schemas";
import type { ServicesRow } from "@/features/services/schemas";

const baseEvent: Omit<ScheduleEventRow, "id" | "type" | "title" | "start_at" | "all_day"> = {
  created_by_email: "x@x.com",
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

const baseService: Omit<
  ServicesRow,
  "id" | "service_id" | "service_name" | "write_start_at" | "write_end_at"
> = {
  application_type: "공통원서",
  region: "서울",
  university_name: "○○대학교",
  university_type: "4년제",
  category: "수시",
  operator_email: null,
  operator_name: null,
  developer_email: null,
  developer_name: null,
  pay_start_at: null,
  pay_end_at: null,
  solo: false,
  source: "google_sheet_import",
  imported_at: null,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

function renderView(overrides: Partial<Parameters<typeof CalendarView>[0]> = {}) {
  const defaults = {
    events: [] as ScheduleEventRow[],
    services: [] as ServicesRow[],
    currentMonth: { year: 2026, month0: 4 },
    view: "calendar" as const,
    canWrite: true,
    todayYmd: "2026-05-18",
    mineActive: false,
    onPersist: vi.fn(async () => ({ ok: true })),
  };
  const props = { ...defaults, ...overrides };
  render(<CalendarView {...props} />);
  return props;
}

describe("CalendarView", () => {
  beforeEach(() => {
    routerPush.mockReset();
  });
  it("currentMonth을 'YYYY.MM' 헤더 + 42셀(6주×7) 그리드로 표시", () => {
    renderView();
    expect(screen.getByText("2026.05")).toBeInTheDocument();
    const cells = screen.getAllByTestId(/^calendar-cell-/);
    expect(cells).toHaveLength(42);
  });

  it("schedule_event를 해당 셀의 dot+제목으로 렌더 (category=shift)", () => {
    const events: ScheduleEventRow[] = [
      {
        ...baseEvent,
        id: "00000000-0000-0000-0000-000000000001",
        type: "shift",
        title: "오전 시프트",
        start_at: "2026-05-15T01:00:00Z",
        all_day: false,
      },
    ];
    renderView({ events });
    expect(screen.getByText("오전 시프트")).toBeInTheDocument();
    const dots = screen.getAllByTestId("calendar-dot");
    expect(dots.some((d) => d.getAttribute("data-category") === "shift")).toBe(true);
  });

  it("service write_start_at/end_at을 service-start/end 카테고리로 렌더", () => {
    const services: ServicesRow[] = [
      {
        ...baseService,
        id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        service_id: 1234,
        service_name: "PIMS 원서",
        write_start_at: "2026-05-10",
        write_end_at: "2026-05-20",
      },
    ];
    renderView({ services });
    const labels = screen.getAllByText("PIMS 원서");
    expect(labels.length).toBe(2); // start + end
    const dots = screen.getAllByTestId("calendar-dot");
    expect(dots.some((d) => d.getAttribute("data-category") === "service-start")).toBe(
      true,
    );
    expect(dots.some((d) => d.getAttribute("data-category") === "service-end")).toBe(
      true,
    );
  });

  it("다음 달 버튼 클릭 → URL ?month=2026-06로 push", () => {
    renderView();
    fireEvent.click(screen.getByLabelText("다음 달"));
    expect(routerPush).toHaveBeenCalledWith(
      expect.stringContaining("month=2026-06"),
      expect.anything(),
    );
  });

  it("이전 달 버튼 클릭 → URL ?month=2026-04로 push", () => {
    renderView();
    fireEvent.click(screen.getByLabelText("이전 달"));
    expect(routerPush).toHaveBeenCalledWith(
      expect.stringContaining("month=2026-04"),
      expect.anything(),
    );
  });

  it("연말 다음 달 → URL ?month=2027-01로 push", () => {
    renderView({ currentMonth: { year: 2026, month0: 11 } });
    fireEvent.click(screen.getByLabelText("다음 달"));
    expect(routerPush).toHaveBeenCalledWith(
      expect.stringContaining("month=2027-01"),
      expect.anything(),
    );
  });

  it("view 토글 클릭 → URL ?view=list로 push", () => {
    renderView();
    fireEvent.click(screen.getByRole("tab", { name: "목록" }));
    expect(routerPush).toHaveBeenCalledWith(
      expect.stringContaining("view=list"),
      expect.anything(),
    );
  });

  it("canWrite=false면 + 새 일정 버튼 hidden", () => {
    renderView({ canWrite: false });
    expect(screen.queryByRole("button", { name: /\+ 새 일정/ })).toBeNull();
  });

  it("todayYmd와 일치하는 셀은 data-today='true' 표시", () => {
    renderView({ todayYmd: "2026-05-18" });
    const todayCell = screen.getByTestId("calendar-cell-2026-05-18");
    expect(todayCell.getAttribute("data-today")).toBe("true");
    // 다른 셀은 false 또는 없음
    const otherCell = screen.getByTestId("calendar-cell-2026-05-19");
    expect(otherCell.getAttribute("data-today")).toBe("false");
  });

  it("아이템 4개 초과 셀에 '+N 더보기' 버튼 노출", () => {
    const events: ScheduleEventRow[] = Array.from({ length: 7 }).map((_, i) => ({
      ...baseEvent,
      id: `00000000-0000-0000-0000-00000000000${i + 1}`,
      type: "event",
      title: `이벤트 ${i + 1}`,
      start_at: "2026-05-15T01:00:00Z",
      all_day: false,
    }));
    renderView({ events });
    // 기본 4개만 표시 + 더보기 버튼 (overflow 3)
    expect(screen.getByRole("button", { name: /\+3 더보기/ })).toBeInTheDocument();
    expect(screen.queryByText("이벤트 5")).toBeNull();
  });

  it("'+N 더보기' 클릭 → 해당 셀의 모든 아이템 표시 + '접기' 버튼", () => {
    const events: ScheduleEventRow[] = Array.from({ length: 6 }).map((_, i) => ({
      ...baseEvent,
      id: `00000000-0000-0000-0000-00000000000${i + 1}`,
      type: "event",
      title: `이벤트 ${i + 1}`,
      start_at: "2026-05-15T01:00:00Z",
      all_day: false,
    }));
    renderView({ events });
    fireEvent.click(screen.getByRole("button", { name: /\+2 더보기/ }));
    // 6개 모두 노출 + 접기 버튼
    expect(screen.getByText("이벤트 5")).toBeInTheDocument();
    expect(screen.getByText("이벤트 6")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /접기/ })).toBeInTheDocument();
  });
});
