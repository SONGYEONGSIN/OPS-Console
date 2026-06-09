"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ScheduleEventRow } from "@/features/schedule/schemas";
import type { ServicesRow } from "@/features/services/schemas";
import type { BackupRequestRow } from "@/features/backup-requests/schemas";
import type { Holiday } from "@/lib/holidays/google-ical";
import type { ListRow } from "../_components/patterns/ListPattern";
import { InspectorPanel } from "../_components/inspector/InspectorPanel";
import { InspectorListBody } from "../_components/inspector/InspectorListBody";
import { InspectorChrome } from "../_components/inspector/InspectorChrome";
import { useInspectorState } from "../_components/inspector/useInspectorState";
import { OPERATORS } from "@/features/auth/operators";
import { servicesRowToListRow } from "../services/_row-mapper";
import { CalendarToolbar } from "./CalendarToolbar";
import {
  buildMonthGrid,
  groupItemsByDay,
  type BackupLeaveInput,
  type CalendarCategory,
  type CalendarItem,
} from "./_calendar-helpers";

type CurrentMonth = { year: number; month0: number };

type Props = {
  events: ScheduleEventRow[];
  services: ServicesRow[];
  /** leave_type가 저장된 백업 요청 — 달력 셀 최상단에 "팀-이름-휴가유형"으로 표기. */
  backupLeaves?: BackupRequestRow[];
  /** Google '한국 공휴일' iCal feed에서 가져온 read-only 항목. 셀 배경 + dot. */
  holidays?: Holiday[];
  currentMonth: CurrentMonth;
  view: "calendar" | "list";
  canWrite: boolean;
  /** KST 기준 오늘 YYYY-MM-DD — 해당 셀 시각 강조 */
  todayYmd: string;
  onPersist: (row: ListRow, isNew: boolean) => Promise<{ ok: boolean; error?: string }>;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const MAX_VISIBLE_ITEMS = 4;

const DOT_COLOR: Record<CalendarCategory, string> = {
  "service-start": "bg-sage",
  "service-end": "bg-indigo",
  "backup-leave": "bg-amber",
  shift: "bg-vermilion",
  event: "bg-ink",
  leave: "bg-line-soft",
  training: "bg-washi-raised border border-line",
  application: "bg-vermilion-deep",
  pims: "bg-gold",
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

function backupRowToListRow(r: BackupRequestRow): ListRow {
  const requester = OPERATORS.find((o) => o.email === r.requester_email);
  const fallbackTitle =
    r.leave_start_date && r.leave_end_date
      ? `${r.leave_start_date} ~ ${r.leave_end_date} 백업`
      : r.summary_md.slice(0, 30);
  return {
    id: r.id,
    name: r.title?.trim() || fallbackTitle,
    status: "active",
    owner: requester?.name ?? r.requester_email,
    requesterTeam: r.requester_team ?? null,
    leaveType: r.leave_type ?? null,
    substituteEmail: r.substitute_email,
    substituteName: r.substitute_name,
    backupServices: r.services_detail.map((s) => s.id),
    backupServicesDetail: r.services_detail,
    summary: r.summary_md,
    leaveStartDate: r.leave_start_date ?? null,
    leaveEndDate: r.leave_end_date ?? null,
    mailStatus: r.mail_status,
    mailSentAt: r.mail_sent_at ?? null,
    mailError: r.mail_error ?? null,
    scheduledAt: r.scheduled_at ?? null,
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
  backupLeaves = [],
  holidays,
  currentMonth,
  view,
  canWrite,
  todayYmd,
  onPersist,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { year, month0 } = currentMonth;

  const cells = useMemo(() => buildMonthGrid(year, month0), [year, month0]);
  const backupLeaveInputs = useMemo<BackupLeaveInput[]>(
    () =>
      backupLeaves
        .filter((r) => r.leave_type && r.leave_start_date)
        .map((r) => ({
          id: r.id,
          team: r.requester_team ?? null,
          name:
            OPERATORS.find((o) => o.email === r.requester_email)?.name ??
            r.requester_email,
          leaveType: r.leave_type as string,
          startYmd: r.leave_start_date as string,
          endYmd: r.leave_end_date ?? null,
          rowRef: r,
        })),
    [backupLeaves],
  );
  const byDay = useMemo(
    () => groupItemsByDay(events, services, backupLeaveInputs),
    [events, services, backupLeaveInputs],
  );
  // ymd → 공휴일 제목들 (보통 1개, 대체공휴일 등으로 2개 이상도 가능)
  const holidaysByDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const h of holidays ?? []) {
      const list = m.get(h.date);
      if (list) list.push(h.title);
      else m.set(h.date, [h.title]);
    }
    return m;
  }, [holidays]);
  const [expandedYmd, setExpandedYmd] = useState<string | null>(null);

  // 인스펙터 상태 — selected는 클릭된 CalendarItem 또는 신규 생성용 blank
  const inspector = useInspectorState<{
    item: CalendarItem | null;
    row: ListRow;
    sourceVariant: "schedule" | "services" | "backup";
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

  const handleItemClick = (item: CalendarItem) => {
    if (item.sourceVariant === "schedule") {
      const ev = item.rowRef as ScheduleEventRow;
      inspector.open({
        item,
        row: eventToListRow(ev),
        sourceVariant: "schedule",
      });
    } else if (item.sourceVariant === "backup") {
      const br = item.rowRef as BackupRequestRow;
      inspector.open({
        item,
        row: backupRowToListRow(br),
        sourceVariant: "backup",
      });
    } else {
      const svc = item.rowRef as ServicesRow;
      inspector.open({
        item,
        row: servicesRowToListRow(svc),
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
      return;
    }
    // 저장 실패 시 사용자에게 사유 노출 — silent fail로 '반응 없음' 오인 방지.
    window.alert(`저장 실패: ${result.error ?? "알 수 없는 오류"}`);
  };

  const selected = inspector.selected;

  return (
    <section className="p-7">
      <CalendarToolbar
        year={year}
        month0={month0}
        view={view}
        canWrite={canWrite}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onViewChange={handleViewChange}
        onNewEvent={handleNewEvent}
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
          const isExpanded = expandedYmd === cell.ymd;
          const visible = isExpanded
            ? items
            : items.slice(0, MAX_VISIBLE_ITEMS);
          const overflow = items.length - visible.length;
          const dayNum = Number(cell.ymd.slice(8, 10));
          const isToday = cell.ymd === todayYmd;
          const holidayTitles = holidaysByDay.get(cell.ymd);
          const isHoliday = !!holidayTitles && holidayTitles.length > 0;
          return (
            <div
              key={cell.ymd}
              data-testid={`calendar-cell-${cell.ymd}`}
              data-ymd={cell.ymd}
              data-today={isToday ? "true" : "false"}
              data-holiday={isHoliday ? "true" : "false"}
              className={`min-h-[100px] p-1.5 text-2xs ${
                isHoliday ? "bg-vermilion/10" : "bg-cream"
              } ${cell.inMonth ? "text-ink" : "text-faint"} ${
                isToday ? "ring-1 ring-inset ring-vermilion" : ""
              }`}
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
                {holidayTitles?.map((title) => (
                  <li key={`holiday-${title}`}>
                    <span
                      data-testid="calendar-holiday"
                      className="flex w-full items-center gap-1 text-left text-2xs text-vermilion"
                    >
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full bg-vermilion"
                        aria-hidden
                      />
                      <span className="truncate">{title}</span>
                    </span>
                  </li>
                ))}
                {visible.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      data-team-common={item.isTeamCommon ? "true" : "false"}
                      className={`flex w-full items-center gap-1 text-left text-2xs text-ink hover:text-vermilion ${
                        item.isTeamCommon ? "font-bold" : ""
                      }`}
                    >
                      <span
                        data-testid="calendar-dot"
                        data-category={item.category}
                        className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[item.category]}`}
                        aria-hidden
                      />
                      {item.isTeamCommon ? (
                        <span
                          aria-hidden
                          className="shrink-0 animate-star-twinkle text-vermilion"
                        >
                          ★
                        </span>
                      ) : null}
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                ))}
                {overflow > 0 ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => setExpandedYmd(cell.ymd)}
                      className="cursor-pointer border-none bg-transparent p-0 text-2xs text-muted hover:text-vermilion"
                    >
                      +{overflow} 더보기
                    </button>
                  </li>
                ) : null}
                {isExpanded && items.length > MAX_VISIBLE_ITEMS ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => setExpandedYmd(null)}
                      className="cursor-pointer border-none bg-transparent p-0 text-2xs text-muted hover:text-vermilion"
                    >
                      접기
                    </button>
                  </li>
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
            <InspectorListBody
              row={selected.row}
              editing={
                selected.sourceVariant === "schedule" && inspector.editing
              }
              onSave={handleSave}
              onCancel={() => {
                if (creating) {
                  inspector.close();
                  setCreating(false);
                } else {
                  inspector.toggleEdit();
                }
              }}
              variant={selected.sourceVariant}
            />
          </InspectorChrome>
        ) : null}
      </InspectorPanel>
    </section>
  );
}
