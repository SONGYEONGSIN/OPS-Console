import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listScheduleEvents } from "@/features/schedule/queries";
import {
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
} from "@/features/schedule/actions";
import { listServicesForCalendar } from "@/features/services/queries";
import { listBackupRequests } from "@/features/backup-requests/queries";
import { fetchKoreanHolidays } from "@/lib/holidays/google-ical";
import { eventToListRow } from "./_row-mapper";
import { CalendarView } from "./CalendarView";
import { ScheduleViewToggle } from "./ScheduleViewToggle";
import { buildMonthGrid } from "./_calendar-helpers";
import { ListPagination } from "@/components/common/ListPagination";
import { paginateRows } from "@/lib/list/paginate";

const MONTH_PARAM_RE = /^(\d{4})-(\d{2})$/;

/**
 * services 데이터는 작년(2025) 기준으로 적재되어 있어 운영부 달력에선 +1년 보정.
 * DB는 손대지 않고 fetch 후 표시 단계에서만 shift. 추후 2026년 데이터가 정상 적재되면 0으로 바꿔 비활성.
 */
const SERVICES_YEAR_OFFSET = 1;

function shiftYmdYear(ymd: string | null, delta: number): string | null {
  if (!ymd) return null;
  const m = /^(\d{4})(.*)$/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[1]) + delta}${m[2]}`;
}

const KST_TODAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getKstTodayYmd(): string {
  return KST_TODAY_FMT.format(new Date());
}

function parseMonthParam(raw: string | undefined): {
  year: number;
  month0: number;
} {
  if (raw) {
    const m = MONTH_PARAM_RE.exec(raw);
    if (m) {
      const year = Number(m[1]);
      const month0 = Number(m[2]) - 1;
      if (month0 >= 0 && month0 <= 11) return { year, month0 };
    }
  }
  const todayYmd = getKstTodayYmd();
  return {
    year: Number(todayYmd.slice(0, 4)),
    month0: Number(todayYmd.slice(5, 7)) - 1,
  };
}

type SearchParams = Promise<{
  view?: string;
  month?: string;
  mine?: string;
  page?: string;
}>;

/**
 * /dashboard/schedule — 운영부 달력 (default = month grid).
 * ?view=list 진입 시 기존 ListPattern (admin/member CRUD).
 * ?month=YYYY-MM 으로 달 이동 (RSC refetch).
 */
export default async function SchedulePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const slug = "schedule";
  await requireMenu(slug);
  const meta = findSidebarMeta(slug);
  if (!meta) return null;

  const sp = await searchParams;
  const view = sp.view === "list" ? "list" : "calendar";
  const mineActive = sp.mine === "true";
  const currentMonth = parseMonthParam(sp.month);
  const pathname = `/dashboard/${slug}`;

  const allEvents = await listScheduleEvents();
  const holidays = await fetchKoreanHolidays();
  const me = await getCurrentOperator();
  const canWrite = me?.permission !== "viewer" && me?.permission !== null;
  const myEmail = me?.email ?? null;

  const events =
    mineActive && myEmail
      ? allEvents.filter(
          (e) => e.assignee_email === myEmail || e.created_by_email === myEmail,
        )
      : allEvents;

  // calendar view면 month grid 범위로 services range fetch.
  // DB 데이터가 작년 기준이라 fetch range는 -OFFSET, 표시 시 +OFFSET shift.
  const grid = buildMonthGrid(currentMonth.year, currentMonth.month0);
  const fetchStart = shiftYmdYear(grid[0]?.ymd ?? null, -SERVICES_YEAR_OFFSET);
  const fetchEnd = shiftYmdYear(
    grid[grid.length - 1]?.ymd ?? null,
    -SERVICES_YEAR_OFFSET,
  );
  const servicesRaw =
    view === "calendar" && fetchStart && fetchEnd
      ? await listServicesForCalendar(fetchStart, fetchEnd)
      : [];
  const servicesShifted = servicesRaw.map((s) => ({
    ...s,
    write_start_at: shiftYmdYear(s.write_start_at, SERVICES_YEAR_OFFSET),
    write_end_at: shiftYmdYear(s.write_end_at, SERVICES_YEAR_OFFSET),
  }));
  const services =
    mineActive && myEmail
      ? servicesShifted.filter(
          (s) => s.operator_email === myEmail || s.developer_email === myEmail,
        )
      : servicesShifted;

  // leave_type가 저장된 백업 요청 → 달력 셀 최상단 "팀-이름-휴가유형" 표기.
  // 캘린더 뷰에서만 fetch. mine=true면 본인이 요청한 휴가만.
  const allBackupLeaves =
    view === "calendar"
      ? (await listBackupRequests({ pageSize: 200 })).rows.filter(
          (r) => r.leave_type && r.leave_start_date,
        )
      : [];
  const backupLeaves =
    mineActive && myEmail
      ? allBackupLeaves.filter((r) => r.requester_email === myEmail)
      : allBackupLeaves;

  const { rows, total } = paginateRows(events.map(eventToListRow), sp.page);
  const config = resolvePageMeta(slug, meta, total);

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
      autoRefresh
    />
  );

  async function onPersist(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const operator = await getCurrentOperator();
    if (isNew) {
      const result = await createScheduleEvent({
        type: row.scheduleType ?? "event",
        title: row.name,
        description: row.body ?? null,
        start_at: row.start_at ?? new Date().toISOString(),
        end_at: row.end_at ?? null,
        all_day: row.allDay ?? false,
        assignee_email: row.assigneeEmail ?? null,
        created_by_email: operator?.email ?? "",
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    if (row.status === "deleted") {
      const result = await deleteScheduleEvent(row.id);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    const result = await updateScheduleEvent(row.id, {
      type: row.scheduleType,
      title: row.name,
      description: row.body ?? null,
      start_at: row.start_at,
      end_at: row.end_at ?? null,
      all_day: row.allDay ?? false,
      assignee_email: row.assigneeEmail ?? null,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  if (view === "calendar") {
    return (
      <>
        {header}
        <CalendarView
          events={events}
          services={services}
          backupLeaves={backupLeaves}
          holidays={holidays}
          currentMonth={currentMonth}
          view="calendar"
          canWrite={canWrite}
          todayYmd={getKstTodayYmd()}
          mineActive={mineActive}
          onPersist={onPersist}
        />
      </>
    );
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="schedule"
      canCreate={canWrite}
      createLabel="+ 새 일정"
      extraActions={<ScheduleViewToggle view="list" />}
      readOnly={!canWrite}
      onPersist={onPersist}
      footer={
        <ListPagination key="schedule-pagination" total={total} pageSize={30} />
      }
    />
  );
}
