import { getCurrentOperator } from "@/features/auth/queries";
import { listServices } from "@/features/services/queries";
import type { ServicesRow } from "@/features/services/schemas";
import { listIncidents } from "@/features/incidents/queries";
import { listContracts } from "@/features/contracts/queries";
import { listBackupRequests } from "@/features/backup-requests/queries";
import { listScheduleEvents } from "@/features/schedule/queries";
import { fetchReceivablesSheet } from "@/features/receivables/queries";
import { listMyTodos } from "@/features/todos/queries";
import { listWorklog } from "@/features/worklog/queries";
import { listContacts } from "@/features/contacts/queries";
import { servicesRowToListRow } from "./services/_row-mapper";
import { incidentToListRow } from "./incidents/_row-mapper";
import { eventToListRow } from "./schedule/_row-mapper";
import { todoToListRow } from "./my-todo/_row-mapper";
import {
  receivablesToListRow,
  isReceivablesDataRow,
} from "./receivables/_row-mapper";
import { LiveOverview } from "./_components/live/LiveOverview";
import { buildLiveTableItems, type LiveTableSources } from "./_components/live/live-table-builder";
import type { ListRow } from "./_components/patterns/ListPattern";

/**
 * /dashboard 실시간 현황 — KPI 타일(9개) + 우선순위 피드.
 *
 * 기본 mine=true. URL `?mine=false` 시 전체 모드.
 */
export default async function DashboardLivePage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const sp = await searchParams;
  const mine = sp.mine !== "false";

  const me = await getCurrentOperator();
  const myEmail = me?.email ?? null;

  // ─── 서비스 (오픈 예정 5건) ─────────────────────────────────
  const todayYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
  }).format(new Date());
  // services는 2000+건 — chunk loop으로 전체 fetch (본인 담당이 앞 200건 밖일 수
  // 있어 pageSize 제한 시 myUniversities/오픈예정 집합에서 누락됨).
  const SVC_CHUNK = 1000;
  const SVC_MAX_PAGES = 10;
  const allServices: ServicesRow[] = [];
  for (let p = 1; p <= SVC_MAX_PAGES; p++) {
    const { rows, total } = await listServices({
      sort: "service_id_asc",
      page: p,
      pageSize: SVC_CHUNK,
    });
    if (rows.length === 0) break;
    allServices.push(...rows);
    if (allServices.length >= total) break;
    if (p * SVC_CHUNK >= total) break; // PGRST103 회피
  }
  // DB는 직전 시즌(2025) 데이터 — UI는 다음 시즌 기준이라 작성 일자에 연도 +1 shift.
  // (schedule / my-todo 와 동일 SERVICES_YEAR_OFFSET 패턴. 원본 데이터 불변.)
  const shiftedServices = allServices.map((s) => ({
    ...s,
    write_start_at: shiftYmdYear(s.write_start_at, 1),
    write_end_at: shiftYmdYear(s.write_end_at, 1),
  }));
  // 오픈 예정 — write_start_at >= today, 가까운 순. client 측 정렬.
  const servicesUpcomingAll = shiftedServices
    .filter(
      (s) => s.write_start_at && s.write_start_at.slice(0, 10) >= todayYmd,
    )
    .filter((s) => (mine && myEmail ? s.operator_email === myEmail : true))
    .sort((a, b) =>
      (a.write_start_at ?? "").localeCompare(b.write_start_at ?? ""),
    );
  // 헤더 카운트는 오픈 예정 전체 수 (리스트 기준과 일치)
  const servicesUpcomingCount = servicesUpcomingAll.length;
  const servicesUpcoming = servicesUpcomingAll.slice(0, 5);
  const servicesListRows: ListRow[] = servicesUpcoming.map(
    servicesRowToListRow,
  );

  // ─── 사고 ─────────────────────────────────────────────
  const { rows: incidents, total: incidentsTotal } = await listIncidents({
    pageSize: 5,
    mine: mine && !!myEmail,
    meEmail: myEmail ?? undefined,
  });
  const incidentsListRows: ListRow[] = incidents.map(incidentToListRow);

  // ─── 미수채권 (시트 fetch — 미입금 우선, 최근 5건) ─────────────
  let receivablesCount: number | null = null;
  try {
    const sheet = await fetchReceivablesSheet();
    if (sheet) {
      const all = sheet.rows
        .map((_, i) => receivablesToListRow(sheet, i))
        .filter(isReceivablesDataRow);
      // mine 기준: 본인 운영자(name)와 일치. all은 client filter
      const filtered =
        mine && me?.displayName
          ? all.filter((r) => r.owner === me.displayName)
          : all;
      // 카운트 = 미입금(pending) 모수 (없으면 전체 모수)
      const pendingAll = filtered.filter((r) => r.status === "active");
      receivablesCount =
        pendingAll.length > 0 ? pendingAll.length : filtered.length;
    }
  } catch {
    /* sheet fetch fail */
  }

  // ─── 계약 (시트 fetch) ──────────────────────────────────────
  let contractsCount: number | null = null;
  try {
    const { rows: contractRows } = await listContracts();
    const filtered = contractRows.filter((r) =>
      mine && me?.displayName ? r.operator === me.displayName : true,
    );
    contractsCount = filtered.length;
  } catch {
    /* sheet fetch fail */
  }

  // ─── 대학연락처 ───────────────────────────────────────────
  // mine=true 시 본인 services의 university_names 집합으로 필터
  const myUniversities =
    mine && myEmail
      ? [
          ...new Set(
            allServices
              .filter((s) => s.operator_email === myEmail)
              .map((s) => s.university_name),
          ),
        ]
      : undefined;
  const { total: contactsTotal } = await listContacts({
    pageSize: 5,
    sort: "created_desc",
    universityIn: myUniversities,
  });

  // ─── 백업 요청 ────────────────────────────────────────────
  // 본인 필터가 client측이므로 모수 정확성을 위해 충분히 fetch (pageSize 100)
  const { rows: backups } = await listBackupRequests({ pageSize: 100 });
  const backupsFiltered = mine && myEmail
    ? backups.filter(
        (b) =>
          b.requester_email === myEmail || b.substitute_email === myEmail,
      )
    : backups;
  const backupCount = backupsFiltered.length;
  const backupListRows: ListRow[] = backupsFiltered.map((b) => ({
    id: b.id,
    name:
      b.leave_start_date && b.leave_end_date
        ? `${b.leave_start_date} ~ ${b.leave_end_date} 백업`
        : b.summary_md.slice(0, 30),
    status: "active",
    owner: b.requester_email,
    substituteEmail: b.substitute_email,
    substituteName: b.substitute_name,
    backupServices: b.services_detail.map((s) => s.id),
    backupServicesDetail: b.services_detail,
    summary: b.summary_md,
    leaveStartDate: b.leave_start_date ?? null,
    leaveEndDate: b.leave_end_date ?? null,
    mailStatus: b.mail_status,
    mailSentAt: b.mail_sent_at ?? null,
    mailError: b.mail_error ?? null,
  }));

  // ─── 운영부 일정 ──────────────────────────────────────────
  const events = await listScheduleEvents();
  const todayDate = new Date();
  const upcomingEventsAll = events
    .filter((e) => new Date(e.start_at) >= todayDate)
    .filter((e) =>
      mine && myEmail
        ? e.assignee_email === myEmail || e.created_by_email === myEmail
        : true,
    );
  const scheduleCount = upcomingEventsAll.length;
  const upcomingEvents = upcomingEventsAll.slice(0, 5);
  const scheduleListRows: ListRow[] = upcomingEvents.map(eventToListRow);

  // ─── 내 할 일 ─────────────────────────────────────────────
  const undoneTodos = (await listMyTodos()).filter((t) => !t.done);
  const todosCount = undoneTodos.length;
  const todosListRows: ListRow[] = undoneTodos.slice(0, 5).map(todoToListRow);

  // ─── 업무 활동 로그 ────────────────────────────────────────
  const { rows: worklog } = await listWorklog({
    pageSize: 5,
    userEmail: mine && myEmail ? myEmail : undefined,
  });

  // ─── 실시간 테이블 소스 ───────────────────────────────────
  const liveTableSources: LiveTableSources = {
    incidents: incidents.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status ?? "미처리",
      createdAt: i.created_at,
      listRow: incidentsListRows.find((r) => r.id === i.id)!,
    })),
    todos: undoneTodos.slice(0, 5).map((t) => ({
      id: t.id,
      title: t.title,
      dueAt: t.due_at ?? null,
      createdAt: t.created_at,
      listRow: todosListRows.find((r) => r.id === t.id) ?? todoToListRow(t),
    })),
    services: servicesUpcoming.map((s) => ({
      id: s.id,
      title: `${s.university_name} · ${s.service_name}`,
      writeStartAt: s.write_start_at,
      createdAt: s.created_at,
      listRow: servicesListRows.find((r) => r.id === s.id) ?? servicesRowToListRow(s),
    })),
    backup: backupsFiltered.slice(0, 10).map((b) => ({
      id: b.id,
      title:
        b.leave_start_date && b.leave_end_date
          ? `${b.leave_start_date} ~ ${b.leave_end_date} 백업`
          : b.summary_md.slice(0, 30),
      status: b.mail_status ?? "pending",
      createdAt: b.created_at,
      listRow: backupListRows.find((r) => r.id === b.id)!,
    })),
    schedule: upcomingEvents.map((e) => ({
      id: e.id,
      title: e.title,
      startAt: e.start_at,
      createdAt: e.created_at,
      listRow: scheduleListRows.find((r) => r.id === e.id) ?? eventToListRow(e),
    })),
  };
  const tableItems = buildLiveTableItems(liveTableSources);

  // 스파크라인 경로는 Task 15에서 실데이터 기반으로 교체 예정
  const SPARKLINE_SAGO =
    "M 0,30 L 15,28 L 30,35 L 45,15 L 60,25 L 75,5 L 90,12 L 100,2";
  const SPARKLINE_SERVICE =
    "M 0,35 L 20,32 L 40,25 L 60,20 L 80,18 L 100,12";

  return (
    <LiveOverview
      mine={mine}
      title="실시간 운영 현황"
      kpi={{
        // Task 15에서 unresolved 카운트 분리 예정
        sago: { count: incidentsTotal, sparklineD: SPARKLINE_SAGO },
        // Task 15에서 done/total 정확한 집계 예정
        todo: { count: todosCount, done: 0, total: todosCount },
        service: { count: servicesUpcomingCount, sparklineD: SPARKLINE_SERVICE },
      }}
      metrics={{
        contract: { value: contractsCount ?? 0, desc: "체결 진행중" },
        bond: {
          value: receivablesCount ?? 0,
          active: (receivablesCount ?? 0) > 0,
          desc: "미지급 고지 발송",
        },
        backup: { value: backupCount, desc: "요청 처리건" },
        contacts: { value: contactsTotal, desc: "등록된 파트너" },
        scheduleActivity: {
          value: `${scheduleCount} / ${worklog.length}`,
          desc: "금주 잔여 건",
        },
      }}
      tableItems={tableItems}
    />
  );
}

/** ISO/ymd 문자열의 연도만 delta 만큼 shift (나머지 보존). null 통과. */
function shiftYmdYear(ymd: string | null, delta: number): string | null {
  if (!ymd) return null;
  const m = /^(\d{4})(.*)$/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[1]) + delta}${m[2]}`;
}
