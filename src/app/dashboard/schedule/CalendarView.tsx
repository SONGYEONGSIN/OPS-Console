"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ScheduleEventRow } from "@/features/schedule/schemas";
import type { ServicesRow } from "@/features/services/schemas";
import type { ListRow } from "../_components/patterns/ListPattern";
import { InspectorPanel } from "../_components/inspector/InspectorPanel";
import { InspectorListBody } from "../_components/inspector/InspectorListBody";
import { InspectorChrome } from "../_components/inspector/InspectorChrome";
import { useInspectorState } from "../_components/inspector/useInspectorState";
import { OPERATORS } from "@/features/auth/operators";
import { CalendarToolbar } from "./CalendarToolbar";
import {
  buildMonthGrid,
  groupItemsByDay,
  type CalendarCategory,
  type CalendarItem,
} from "./_calendar-helpers";

type CurrentMonth = { year: number; month0: number };

type Props = {
  events: ScheduleEventRow[];
  services: ServicesRow[];
  currentMonth: CurrentMonth;
  view: "calendar" | "list";
  canWrite: boolean;
  /** KST 기준 오늘 YYYY-MM-DD — 해당 셀 시각 강조 */
  todayYmd: string;
  /** ?mine=true 활성 시 본인 일정만 표시 (서버에서 이미 필터 적용된 데이터) */
  mineActive: boolean;
  onPersist: (row: ListRow, isNew: boolean) => Promise<{ ok: boolean; error?: string }>;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const MAX_VISIBLE_ITEMS = 4;

const DOT_COLOR: Record<CalendarCategory, string> = {
  "service-start": "bg-sage",
  "service-end": "bg-indigo",
  shift: "bg-vermilion",
  event: "bg-ink",
  leave: "bg-line-soft",
  training: "bg-washi-raised border border-line",
};

function eventToListRow(ev: ScheduleEventRow): ListRow {
  const assignee = ev.assignee_email
    ? OPERATORS.find((o) => o.email === ev.assignee_email)
    : null;
  return {
    id: ev.id,
    name: ev.title,
    body: ev.description ?? undefined,
    status: "active",
    owner: assignee?.name ?? "",
    scheduleType: ev.type,
    start_at: ev.start_at,
    end_at: ev.end_at ?? null,
    allDay: ev.all_day,
    assigneeEmail: ev.assignee_email ?? null,
    createdByEmail: ev.created_by_email,
  };
}

function blankScheduleListRow(defaultYmd: string): ListRow {
  return {
    id: "",
    name: "",
    body: "",
    status: "active",
    owner: "",
    scheduleType: "event",
    start_at: `${defaultYmd}T09:00:00+09:00`,
    end_at: null,
    allDay: false,
    assigneeEmail: null,
    createdByEmail: "",
  };
}

export function CalendarView({
  events,
  services,
  currentMonth,
  view,
  canWrite,
  todayYmd,
  mineActive,
  onPersist,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { year, month0 } = currentMonth;

  const cells = useMemo(() => buildMonthGrid(year, month0), [year, month0]);
  const byDay = useMemo(() => groupItemsByDay(events, services), [events, services]);

  // 인스펙터 상태 — selected는 클릭된 CalendarItem 또는 신규 생성용 blank
  const inspector = useInspectorState<{
    item: CalendarItem | null;
    row: ListRow;
    sourceVariant: "schedule" | "services";
  }>();

  const [creating, setCreating] = useState(false);

  const pushMonth = (next: CurrentMonth) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("view", "calendar");
    sp.set("month", `${next.year}-${String(next.month0 + 1).padStart(2, "0")}`);
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const handlePrev = () => {
    pushMonth(
      month0 === 0 ? { year: year - 1, month0: 11 } : { year, month0: month0 - 1 },
    );
  };
  const handleNext = () => {
    pushMonth(
      month0 === 11 ? { year: year + 1, month0: 0 } : { year, month0: month0 + 1 },
    );
  };
  const handleToday = () => {
    const now = new Date();
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    pushMonth({
      year: Number(ymd.slice(0, 4)),
      month0: Number(ymd.slice(5, 7)) - 1,
    });
  };

  const handleViewChange = (next: "calendar" | "list") => {
    const sp = new URLSearchParams(searchParams.toString());
    if (next === "list") {
      sp.set("view", "list");
      sp.delete("month");
    } else {
      sp.set("view", "calendar");
    }
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const handleToggleMine = () => {
    const sp = new URLSearchParams(searchParams.toString());
    if (mineActive) sp.delete("mine");
    else sp.set("mine", "true");
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const handleItemClick = (item: CalendarItem) => {
    if (item.sourceVariant === "schedule") {
      const ev = item.rowRef as ScheduleEventRow;
      inspector.open({
        item,
        row: eventToListRow(ev),
        sourceVariant: "schedule",
      });
    } else {
      const svc = item.rowRef as ServicesRow;
      inspector.open({
        item,
        row: {
          id: svc.id,
          name: svc.service_name,
          status: "active",
          owner: svc.operator_email ?? "",
          meta: svc.university_name ?? undefined,
        },
        sourceVariant: "services",
      });
    }
    setCreating(false);
  };

  const handleNewEvent = () => {
    const todayYmd = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    inspector.open({
      item: null,
      row: blankScheduleListRow(todayYmd),
      sourceVariant: "schedule",
    });
    setCreating(true);
    inspector.toggleEdit();
  };

  const handleSave = async (next: ListRow) => {
    const result = await onPersist(next, creating);
    if (result.ok) {
      inspector.close();
      setCreating(false);
    }
  };

  const selected = inspector.selected;

  return (
    <section className="p-7">
      <CalendarToolbar
        year={year}
        month0={month0}
        view={view}
        canWrite={canWrite}
        mineActive={mineActive}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onViewChange={handleViewChange}
        onNewEvent={handleNewEvent}
        onToggleMine={handleToggleMine}
      />

      <div className="grid grid-cols-7 gap-px border border-line bg-line-soft">
        {WEEKDAY_LABELS.map((wd, i) => (
          <div
            key={wd}
            className={`bg-cream py-2 text-center text-xs font-bold ${
              i === 0 ? "text-vermilion" : i === 6 ? "text-indigo" : "text-ink"
            }`}
          >
            {wd}
          </div>
        ))}
        {cells.map((cell) => {
          const items = byDay.get(cell.ymd) ?? [];
          const visible = items.slice(0, MAX_VISIBLE_ITEMS);
          const overflow = items.length - visible.length;
          const dayNum = Number(cell.ymd.slice(8, 10));
          const isToday = cell.ymd === todayYmd;
          return (
            <div
              key={cell.ymd}
              data-testid={`calendar-cell-${cell.ymd}`}
              data-ymd={cell.ymd}
              data-today={isToday ? "true" : "false"}
              className={`min-h-[100px] bg-cream p-1.5 text-2xs ${
                cell.inMonth ? "text-ink" : "text-faint"
              } ${isToday ? "ring-1 ring-inset ring-vermilion" : ""}`}
            >
              <div className="mb-1">
                <span
                  className={`inline-block min-w-[1.25rem] px-1 text-xs font-medium ${
                    isToday
                      ? "bg-vermilion text-cream"
                      : ""
                  }`}
                >
                  {dayNum}
                </span>
              </div>
              <ul className="space-y-0.5">
                {visible.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className="flex w-full items-center gap-1 text-left text-2xs text-ink hover:text-vermilion"
                    >
                      <span
                        data-testid="calendar-dot"
                        data-category={item.category}
                        className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[item.category]}`}
                        aria-hidden
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                ))}
                {overflow > 0 ? (
                  <li className="text-2xs text-muted">+{overflow}</li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>

      <InspectorPanel
        open={selected !== null}
        onClose={() => {
          inspector.close();
          setCreating(false);
        }}
      >
        {selected ? (
          <InspectorChrome
            row={selected.row}
            editing={inspector.editing}
            onToggleEdit={inspector.toggleEdit}
            editable={selected.sourceVariant === "schedule" && canWrite}
          >
            {selected.sourceVariant === "schedule" ? (
              <InspectorListBody
                row={selected.row}
                editing={inspector.editing}
                onSave={handleSave}
                onCancel={() => {
                  if (creating) {
                    inspector.close();
                    setCreating(false);
                  } else {
                    inspector.toggleEdit();
                  }
                }}
                variant="schedule"
              />
            ) : (
              <div className="space-y-5 text-sm text-ink">
                <section className="space-y-1.5">
                  <p className="text-2xs uppercase tracking-[0.18em] text-muted">
                    원서접수
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span
                      className={`inline-block px-2 py-0.5 text-2xs ${
                        selected.item?.category === "service-start"
                          ? "bg-sage text-cream"
                          : "bg-indigo text-cream"
                      }`}
                    >
                      {selected.item?.category === "service-start"
                        ? "접수 시작"
                        : "접수 종료"}
                    </span>
                    <span className="text-xs">
                      <span className="text-muted">날짜</span>{" "}
                      <span className="font-mono text-ink">
                        {selected.item?.ymd}
                      </span>
                    </span>
                    <span className="text-xs">
                      <span className="text-muted">담당</span>{" "}
                      <span className="text-ink">
                        {selected.row.owner || "-"}
                      </span>
                    </span>
                  </div>
                </section>
                <p className="text-2xs text-muted">
                  ※ 서비스 상세 편집은 서비스 메뉴에서 가능합니다.
                </p>
              </div>
            )}
          </InspectorChrome>
        ) : null}
      </InspectorPanel>
    </section>
  );
}
