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
import { LiveOverview, type KpiTileConfig } from "./_components/live/LiveOverview";
import { buildFeedItems, sortFeedItems, type FeedSources } from "./_components/live/feed";
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

  // ─── KPI 타일 ─────────────────────────────────────────────
  const tiles: KpiTileConfig[] = [
    { variant: "services",    label: "서비스",     count: servicesUpcomingCount, countSub: mine ? "내 담당 · 오픈 예정" : "오픈 예정",         href: "/dashboard/services" },
    { variant: "contracts",   label: "계약",       count: contractsCount,        countSub: mine ? "내 계약" : "registered",                    href: "/dashboard/contracts" },
    { variant: "receivables", label: "미수채권",   count: receivablesCount,      countSub: mine ? "내 발송" : "pending",                       href: "/dashboard/receivables" },
    { variant: "incidents",   label: "사고",       count: incidentsTotal,        countSub: mine ? "내가 등록/담당" : "registered",             href: "/dashboard/incidents" },
    { variant: "backup",      label: "백업",       count: backupCount,           countSub: mine ? "내가 요청/백업자" : "registered",           href: "/dashboard/backup" },
    { variant: "contacts",    label: "대학연락처", count: contactsTotal,         countSub: mine ? "내 대학 연락처" : "registered",             href: "/dashboard/contacts" },
    { variant: "weekly-todo", label: "내 할일",    count: todosCount,            countSub: "미완",                                             href: "/dashboard/my-todo" },
    { variant: "schedule",    label: "일정",       count: scheduleCount,         countSub: mine ? "내 일정 · 예정" : "예정",                   href: "/dashboard/schedule" },
    { variant: "worklog",     label: "활동로그",   count: worklog.length,        countSub: mine ? "내 활동" : "최근",                          href: "/dashboard/worklog" },
  ];

  // ─── 피드 소스 ────────────────────────────────────────────
  const feedSources: FeedSources = {
    incidents: incidents.map((i) => ({
      id: i.id,
      title: i.title,
      occurred_date: i.occurred_date ?? i.created_at,
      status: i.status ?? "미처리",
      listRow: incidentsListRows.find((r) => r.id === i.id)!,
    })),
    todos: undoneTodos.map((t) => ({
      id: t.id,
      title: t.title,
      due_at: t.due_at ?? null,
      listRow: todosListRows.find((r) => r.id === t.id) ?? todoToListRow(t),
    })),
    services: servicesUpcoming.map((s) => ({
      id: s.id,
      title: `${s.university_name} · ${s.service_name}`,
      write_start_at: s.write_start_at,
      listRow: servicesListRows.find((r) => r.id === s.id) ?? servicesRowToListRow(s),
    })),
    schedule: upcomingEvents.map((e) => ({
      id: e.id,
      title: e.title,
      start_at: e.start_at,
      listRow: scheduleListRows.find((r) => r.id === e.id) ?? eventToListRow(e),
    })),
    backup: backupsFiltered.slice(0, 10).map((b) => ({
      id: b.id,
      title: b.summary_md.slice(0, 30),
      leave_start_date: b.leave_start_date ?? null,
      listRow: backupListRows.find((r) => r.id === b.id)!,
    })),
  };

  const feedItems = sortFeedItems(buildFeedItems(feedSources)).slice(0, 20);

  return <LiveOverview mine={mine} tiles={tiles} feedItems={feedItems} />;
}

/** ISO/ymd 문자열의 연도만 delta 만큼 shift (나머지 보존). null 통과. */
function shiftYmdYear(ymd: string | null, delta: number): string | null {
  if (!ymd) return null;
  const m = /^(\d{4})(.*)$/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[1]) + delta}${m[2]}`;
}
