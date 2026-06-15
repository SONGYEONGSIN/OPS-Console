import { getCurrentOperator } from "@/features/auth/queries";
import { listServices } from "@/features/services/queries";
import type { ServicesRow } from "@/features/services/schemas";
import { listIncidents } from "@/features/incidents/queries";
import { listContracts } from "@/features/contracts/queries";
import { listBackupRequests } from "@/features/backup-requests/queries";
import { listScheduleEvents } from "@/features/schedule/queries";
import { fetchReceivablesSheet } from "@/features/receivables/queries";
import { listMyTodos } from "@/features/todos/queries";
import { listMyProjectsWithTasks } from "@/features/projects/queries";
import { listAiWorks } from "@/features/ai-work/queries";
import { listClosing } from "@/features/closing/queries";
import { listWorklog } from "@/features/worklog/queries";
import { worklogRowsToConsoleLines } from "@/features/worklog/to-console-line";
import { listContacts } from "@/features/contacts/queries";
import { listPosts } from "@/features/posts/queries";
import type { PostRow } from "@/features/posts/schemas";
import { OPERATORS } from "@/features/auth/operators";
import { contractsRowToListRow } from "./contracts/_row-mapper";
import type { ContractRow } from "@/features/contracts/schemas";
import { createClient } from "@/lib/supabase/server";
import { servicesRowToListRow } from "./services/_row-mapper";
import { incidentToListRow } from "./incidents/_row-mapper";
import { eventToListRow } from "./schedule/_row-mapper";
import { todoToListRow } from "./my-todo/_row-mapper";
import {
  receivablesToListRow,
  isReceivablesDataRow,
} from "./receivables/_row-mapper";
import { LiveOverview } from "./_components/live/LiveOverview";
import {
  buildLiveTableItems,
  filterByAcademicYear,
  type LiveTableSources,
} from "./_components/live/live-table-builder";
import type { HealthGatewayItem } from "./_components/live/command/HealthGateway";
import type { HeadlineInput } from "./_components/live/command/headline-selector";
import { buildActivityLog } from "./_components/live/broadsheet/activity-log";
import {
  buildTimelineEvents,
  type TimelineSource,
} from "./_components/live/broadsheet/timeline-events";
import { listTodayAutomationRuns } from "@/features/automations/today-runs";
import { academicYearRange } from "@/lib/academic-year";
import {
  getSystemHealth,
  type SystemHealthSnapshot,
} from "@/features/system-health/queries";
import type { ListRow } from "./_components/patterns/ListPattern";
import type { LifecycleStage } from "./_components/live/lifecycle/LifecyclePipe";

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
  const me = await getCurrentOperator();
  const myEmail = me?.email ?? null;
  // admin 계정은 기본 '전체' 관점, 그 외는 기본 '내 담당'. URL ?mine 명시 시 우선.
  const mine =
    sp.mine === undefined ? me?.permission !== "admin" : sp.mine !== "false";

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
  const servicesListRows: ListRow[] =
    servicesUpcoming.map(servicesRowToListRow);

  // ─── 사고 ─────────────────────────────────────────────
  // KPI용: 전체 사고 fetch → 미해결(처리완료 제외) 카운트 분리
  const { rows: allIncidentsForKpi } = await listIncidents({
    pageSize: 1000,
    mine: mine && !!myEmail,
    meEmail: myEmail ?? undefined,
  });
  // 사고처리 카운트 — 담당자(assignee) 등록된 사고 중, 발생일(occurred_date)이
  // 현재 학년도(3/1~익년 2월말) 범위인 건만. 학년도는 매년 자동 롤오버.
  const acadYear = academicYearRange(todayYmd);
  const incidentsUnresolvedCount = allIncidentsForKpi.filter(
    (i) =>
      !!i.assignee_email &&
      !!i.occurred_date &&
      i.occurred_date >= acadYear.start &&
      i.occurred_date < acadYear.end,
  ).length;
  // LiveTable용: 최근 20건 슬라이스
  const incidents = allIncidentsForKpi.slice(0, 20);
  const incidentsListRows: ListRow[] = incidents.map((i) =>
    incidentToListRow(i),
  );

  // ─── 미수채권 (시트 fetch — 수금완료/전체 fraction + 미수 카운트) ─────────────
  let receivablesPaid = 0;
  let receivablesTotal = 0;
  let receivablesUnpaid = 0;
  // 피드 소스용 — 본인(또는 전체) 미수채권 ListRow 최근 20건
  const receivablesFeedRows: ListRow[] = [];
  try {
    const sheet = await fetchReceivablesSheet();
    if (sheet) {
      const all = sheet.rows
        .map((_, i) => receivablesToListRow(sheet, i))
        .filter(isReceivablesDataRow);
      const filtered =
        mine && me?.displayName
          ? all.filter((r) => r.owner === me.displayName)
          : all;
      receivablesTotal = filtered.length;
      receivablesPaid = filtered.filter((r) => r.status === "approved").length;
      receivablesUnpaid = filtered.filter((r) => r.status === "active").length;
      receivablesFeedRows.push(...filtered.slice(0, 20));
    }
  } catch {
    /* sheet fetch fail */
  }

  // ─── 계약 (시트 fetch — 체결완료/전체 fraction + 미체결 카운트) ─────────
  let contractsCompleted = 0;
  let contractsTotal = 0;
  let contractsUnconcluded = 0;
  // 피드 소스용 — 본인(또는 전체) 계약 행 최근 20건
  const contractsFeedRows: ContractRow[] = [];
  try {
    const { rows: contractRows } = await listContracts();
    const filtered = contractRows.filter((r) =>
      mine && me?.displayName ? r.operator === me.displayName : true,
    );
    contractsTotal = filtered.length;
    contractsCompleted = filtered.filter((r) => r.status === "계약완료").length;
    contractsUnconcluded = contractsTotal - contractsCompleted;
    contractsFeedRows.push(...filtered.slice(0, 20));
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
  // 본인 필터(requester/substitute)가 client측이므로 모수 정확성을 위해 충분히 fetch.
  // 100건은 운영 누적에서 쉽게 초과 → 1000으로 상향.
  const { rows: backups } = await listBackupRequests({ pageSize: 1000 });
  const backupsFiltered =
    mine && myEmail
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
  // 일정(schedule_events)은 운영부 공유 캘린더 — mine 모드에서도 항상 전체 노출.
  const events = await listScheduleEvents();
  const todayDate = new Date();
  const upcomingEventsAll = events.filter(
    (e) => new Date(e.start_at) >= todayDate,
  );
  // LiveTable 다른 도메인(incidents/todos/backup/handover)과 동일하게 20건 슬라이스.
  const upcomingEvents = upcomingEventsAll.slice(0, 20);
  const scheduleListRows: ListRow[] = upcomingEvents.map(eventToListRow);

  // ─── 내 할 일 ─────────────────────────────────────────────
  const allTodos = await listMyTodos();
  const undoneTodos = allTodos.filter((t) => !t.done);
  const todosCount = undoneTodos.length;
  const todosDone = allTodos.length - undoneTodos.length;
  const todosTotal = allTodos.length;
  const todosListRows: ListRow[] = undoneTodos.slice(0, 20).map(todoToListRow);

  // ─── 프로젝트 (project_tasks 진행률 — 핵심 지표 '내 할 일 · 프로젝트') ──────
  // 주요업무(todos)와 짝을 이루는 카테고리. project_tasks done/total 집계.
  const myProjects = await listMyProjectsWithTasks();
  const allProjectTasks = myProjects.flatMap((p) => p.tasks);
  const projectTasksTotal = allProjectTasks.length;
  const projectTasksDone = allProjectTasks.filter(
    (t) => t.status === "done",
  ).length;

  // ─── AI 산출물 (ai_work 수 — 핵심 지표) ───────────────────────
  // mine 모드면 본인(author_email) 산출물만, 전체 모드면 운영부 전체.
  const aiWorks = await listAiWorks(
    mine && myEmail ? { authorEmail: myEmail } : undefined,
  );
  const aiOutputsCount = aiWorks.length;

  // ─── 콘솔 초기 시드용 30건 (전체 도메인, DESC → reverse로 오름차순 변환) ──
  const { rows: consoleWorklogRows } = await listWorklog({ pageSize: 30 });
  const initialConsoleLines = worklogRowsToConsoleLines(consoleWorklogRows);

  // ─── 인수인계 ─────────────────────────────────────────────────
  // 본인(또는 전체) 담당 서비스 범위 기준:
  //   value = '{인수인계 작성 서비스}/{담당 서비스 전체}'
  //   desc  = '({published 인수인계}건) 진행 완료'
  const supabase = await createClient();
  const myOwnServices =
    mine && myEmail
      ? allServices.filter((s) => s.operator_email === myEmail)
      : allServices;
  const myServiceIds = myOwnServices.map((s) => s.id);
  const myServicesCount = myServiceIds.length;

  // LiveTable용 인수인계 최근 20건 (기존)
  let hq = supabase
    .from("handover_records")
    .select("id, author_email, author_name, service_id, status, created_at");
  if (mine && myEmail) hq = hq.eq("author_email", myEmail);
  hq = hq.order("created_at", { ascending: false }).limit(20);
  const { data: handoverRows } = await hq;

  // 서브카드 분수용 — 담당 서비스 범위의 handover_records status 모음
  let handoverWrittenCount = 0;
  let handoverPublishedCount = 0;
  if (myServiceIds.length > 0) {
    const { data: scopedHandover } = await supabase
      .from("handover_records")
      .select("status")
      .in("service_id", myServiceIds);
    const rows = scopedHandover ?? [];
    handoverWrittenCount = rows.length;
    handoverPublishedCount = rows.filter(
      (r) => r.status === "published",
    ).length;
  }

  const servicesByIdLookup = new Map(
    allServices.map((s) => [s.id, s] as const),
  );
  const handoverSources = (handoverRows ?? []).map((h) => {
    const svc = servicesByIdLookup.get(h.service_id);
    const title = svc
      ? `${svc.university_name} · ${svc.service_name}`
      : `(서비스 누락) ${String(h.service_id).slice(0, 8)}`;
    const listRow: ListRow = {
      id: h.id,
      name: title,
      status: "active",
      owner: h.author_email,
    };
    return {
      id: h.id,
      title,
      status: h.status as string,
      createdAt: h.created_at as string,
      listRow,
    };
  });

  // ─── 공지 (게시판 notice 도메인 — 최근 20건) ───────────────
  // 공지는 운영부 공유 — mine 모드와 무관하게 전체 노출.
  let noticeRows: PostRow[] = [];
  try {
    noticeRows = (await listPosts("notice")).slice(0, 20);
  } catch {
    /* notice fetch fail */
  }

  // ─── 실시간 테이블 소스 ───────────────────────────────────
  const liveTableSources: LiveTableSources = {
    incidents: incidents.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status ?? "미처리",
      createdAt: i.created_at,
      occurredDate: i.occurred_date ?? null,
      listRow: incidentsListRows.find((r) => r.id === i.id)!,
    })),
    todos: undoneTodos.slice(0, 20).map((t) => ({
      id: t.id,
      title: t.title,
      body: t.body ?? null,
      dueAt: t.due_at ?? null,
      createdAt: t.created_at,
      listRow: todosListRows.find((r) => r.id === t.id) ?? todoToListRow(t),
    })),
    services: servicesUpcoming.map((s) => ({
      id: s.id,
      title: `${s.university_name} · ${s.service_name}`,
      writeStartAt: s.write_start_at,
      createdAt: s.created_at,
      listRow:
        servicesListRows.find((r) => r.id === s.id) ?? servicesRowToListRow(s),
    })),
    backup: backupsFiltered.slice(0, 20).map((b) => ({
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
    handover: handoverSources,
    contracts: contractsFeedRows.map((r) => ({
      id: r.id,
      title: r.name,
      status: r.status,
      listRow: contractsRowToListRow(r),
    })),
    notice: noticeRows.map((p) => {
      const author = OPERATORS.find((o) => o.email === p.author_email);
      const listRow: ListRow = {
        id: p.id,
        slug: p.slug ?? undefined,
        name: p.title,
        body: p.body ?? undefined,
        author: author?.name ?? p.author_email,
        owner: p.owner_label ?? "",
        status: p.status as ListRow["status"],
        meta: p.created_at,
      };
      return { id: p.id, title: p.title, createdAt: p.created_at, listRow };
    }),
    receivables: receivablesFeedRows.map((r) => ({
      id: r.id,
      title: r.name ?? "",
      status: String(r.status ?? "active"),
      billedAt: r.meta ?? "",
      listRow: r,
    })),
  };
  // 긴급도 분류·우선순위 피드 모두 현재 학년도(3/1~익년 2월말)로 스코프.
  // refDate(의미 날짜 우선, 없으면 등록일) 기준. 매년 자동 롤오버.
  const tableItems = filterByAcademicYear(
    buildLiveTableItems(liveTableSources),
    acadYear.start,
    acadYear.end,
  );

  // ─── 자동 헤드라인(AutoHeadline) 입력 구성 ───────────────────
  // incidentsUnresolved: 미처리(상태 != '처리완료') + 현재 학년도 발생 건.
  // 핵심 지표 사고처리·긴급도 분류와 동일하게 학년도(occurred_date) 기준으로 통일.
  const unresolvedIncidents = allIncidentsForKpi.filter(
    (i) =>
      (i.status ?? "미처리") !== "처리완료" &&
      !!i.occurred_date &&
      i.occurred_date >= acadYear.start &&
      i.occurred_date < acadYear.end,
  );
  // deadlinesToday: 오픈 예정(servicesUpcomingAll) 중 write_start_at 가 오늘(D-0)인 건.
  const deadlinesTodayServices = servicesUpcomingAll.filter(
    (s) => s.write_start_at?.slice(0, 10) === todayYmd,
  );
  // inProgressServices: 작성 기간 진행 중 — write_start ≤ 오늘 ≤ write_end (mine 필터 동일).
  const inProgressServicesCount = shiftedServices.filter((s) => {
    const start = s.write_start_at?.slice(0, 10);
    const end = s.write_end_at?.slice(0, 10);
    if (!start || start > todayYmd) return false;
    if (end && end < todayYmd) return false;
    return mine && myEmail ? s.operator_email === myEmail : true;
  }).length;
  const topDeadline = deadlinesTodayServices[0];
  const topIncident = unresolvedIncidents[0];
  const headline: HeadlineInput = {
    incidentsUnresolved: unresolvedIncidents.length,
    deadlinesToday: deadlinesTodayServices.length,
    // 미수 10일+ 일수 임계값은 page.tsx 시트 모수에 없어 미수(active) 전체 건수로 대체.
    overdueReceivables: receivablesUnpaid,
    inProgressServices: inProgressServicesCount,
    topDeadlineLabel: topDeadline
      ? `${topDeadline.university_name} · ${topDeadline.service_name}`
      : undefined,
    topIncidentLabel: topIncident?.title ?? undefined,
  };

  // ─── 시스템 게이트웨이(CommandBar HealthGateway) — 서버 측 1회 측정 ─────────
  const healthSnapshot = await getSystemHealth();
  const healthItems = snapshotToHealthItems(healthSnapshot);

  // 스파크라인 경로는 Task 15에서 실데이터 기반으로 교체 예정
  const SPARKLINE_SAGO =
    "M 0,30 L 15,28 L 30,35 L 45,15 L 60,25 L 75,5 L 90,12 L 100,2";
  const SPARKLINE_SERVICE = "M 0,35 L 20,32 L 40,25 L 60,20 L 80,18 L 100,12";

  // ─── ② 서비스 라이프사이클 파이프 (soon → prog → done → settle) ─────────
  // 진행중/마감은 closing_services 테이블 기준. mine 시 operator_name 으로 본인만.
  // listClosing 실패 시 count=null("—") 폴백.
  const closingOperatorName =
    mine && me?.displayName ? me.displayName : undefined;
  let progCount: number | null = null;
  let doneCount: number | null = null;
  try {
    const [openRes, closedRes] = await Promise.all([
      listClosing({
        closedStatus: "open",
        operatorName: closingOperatorName,
        pageSize: 1,
      }),
      listClosing({
        closedStatus: "closed",
        operatorName: closingOperatorName,
        pageSize: 1,
      }),
    ]);
    progCount = openRes.total;
    doneCount = closedRes.total;
  } catch {
    /* closing fetch fail → '—' 셸 폴백 유지 */
  }

  const lifecycle: LifecycleStage[] = [
    {
      label: "오픈 예정",
      tag: "오픈 준비",
      count: servicesUpcomingCount,
      meta: "배포 준비 완료",
      variant: "soon",
      sparklineD: SPARKLINE_SERVICE,
    },
    {
      label: "진행 중",
      tag: "작성 중",
      count: progCount,
      meta: "서비스 마감 연동",
      variant: "prog",
    },
    {
      label: "마감 완료",
      tag: "마감",
      count: doneCount,
      meta: doneCount === null ? "마감 집계" : `누적 마감 ${doneCount}`,
      variant: "done",
    },
    {
      label: "전형료 정산",
      tag: "예정",
      count: null,
      meta: "백엔드 후속",
      variant: "settle",
    },
  ];

  // ─── 실시간 운영 로그 타임라인 — 9 도메인(오늘 KST, 09:00–18:00 배치) ──────
  // 혼합 시각: 서비스 오픈=write_start_at, 서비스 마감=pay_end_at, 그 외=created_at.
  const [closingTimelineRes, feedbackTimelinePosts, automationRuns] =
    await Promise.all([
      listClosing({
        closedStatus: "all",
        operatorName: closingOperatorName,
        pageSize: 500,
      }).catch(() => ({ rows: [], total: 0 })),
      listPosts("feedback").catch(() => [] as PostRow[]),
      listTodayAutomationRuns(todayYmd).catch(() => []),
    ]);

  const backupTitle = (b: (typeof backupsFiltered)[number]) =>
    b.leave_start_date && b.leave_end_date
      ? `${b.leave_start_date} ~ ${b.leave_end_date} 백업`
      : b.summary_md.slice(0, 30);

  const timelineSources: TimelineSource[] = [
    // 서비스 항목은 '서비스 마감' 도메인(closing, 결제 마감 시각)에서만 가져온다.
    // (서비스 오픈/작성시작 출처는 타임라인에서 제외 — 출처 통일)
    ...closingTimelineRes.rows.map((c) => ({
      id: `cls-${c.id}`,
      atIso: c.pay_end_at ?? "",
      domain: "서비스 마감",
      text: `${c.university_name} · ${c.service_name}`,
      tone: "info" as const,
    })),
    ...allTodos.map((t) => ({
      id: `todo-${t.id}`,
      atIso: t.created_at,
      domain: "할일",
      text: t.title,
      tone: "info" as const,
    })),
    ...myProjects
      .flatMap((p) => p.tasks)
      .map((t) => ({
        id: `ptask-${t.id}`,
        atIso: t.created_at,
        domain: "할일",
        text: t.name,
        tone: "info" as const,
      })),
    ...automationRuns.map((r) => ({
      id: r.id,
      atIso: r.atIso,
      domain: "자동화",
      text: r.count > 1 ? `${r.label} ${r.count}건` : r.label,
      tone: "info" as const,
    })),
    ...backupsFiltered.map((b) => ({
      id: `bak-${b.id}`,
      atIso: b.created_at,
      domain: "백업",
      text: backupTitle(b),
      tone: "info" as const,
    })),
    ...handoverSources.map((h) => ({
      id: `ho-${h.id}`,
      atIso: h.createdAt,
      domain: "인수인계",
      text: h.title,
      tone: "info" as const,
    })),
    ...allIncidentsForKpi.map((i) => ({
      id: `inc-${i.id}`,
      atIso: i.created_at,
      domain: "사고",
      text: i.title,
      tone: "err" as const,
    })),
    ...noticeRows.map((p) => ({
      id: `ntc-${p.id}`,
      atIso: p.created_at,
      domain: "공지",
      text: p.title,
      tone: "info" as const,
    })),
    ...feedbackTimelinePosts.map((p) => ({
      id: `fb-${p.id}`,
      atIso: p.created_at,
      domain: "개선",
      text: p.title,
      tone: "info" as const,
    })),
  ];
  const timelineEvents = buildTimelineEvents(timelineSources, todayYmd);

  return (
    <LiveOverview
      mine={mine}
      myEmail={myEmail}
      title="실시간 현황"
      kpi={{
        sago: { count: incidentsUnresolvedCount, sparklineD: SPARKLINE_SAGO },
        todo: { count: todosCount, done: todosDone, total: todosTotal },
        service: {
          count: servicesUpcomingCount,
          sparklineD: SPARKLINE_SERVICE,
        },
      }}
      metrics={{
        contract: {
          value: { num: contractsCompleted, den: contractsTotal },
          desc: `(${contractsUnconcluded.toLocaleString("ko-KR")}) 미체결 계약`,
        },
        bond: {
          value: { num: receivablesPaid, den: receivablesTotal },
          active: receivablesUnpaid > 0,
          desc: `(${receivablesUnpaid.toLocaleString("ko-KR")}) 미수금 내역`,
        },
        backup: { value: backupCount, desc: "요청 및 내역" },
        contacts: { value: contactsTotal, desc: "등록한 연락처" },
        handover: {
          value: { num: handoverWrittenCount, den: myServicesCount },
          desc: `(${handoverPublishedCount.toLocaleString("ko-KR")}) 진행 완료`,
        },
      }}
      keyMetrics={{
        todoWeekly: { done: todosDone, total: todosTotal },
        todoProject: { done: projectTasksDone, total: projectTasksTotal },
        aiOutputs: aiOutputsCount,
        incidents: incidentsUnresolvedCount,
        serviceClosed: doneCount,
      }}
      lifecycle={lifecycle}
      tableItems={tableItems}
      initialConsoleLines={initialConsoleLines}
      healthItems={healthItems}
      logLines={initialConsoleLines}
      headline={headline}
      activityLog={buildActivityLog(consoleWorklogRows)}
      timelineEvents={timelineEvents}
    />
  );
}

/**
 * SystemHealthSnapshot → HealthGatewayItem[] (7개, SystemHealthPanel과 동일 순서:
 * YouTube → Supabase → Cron → Graph → SharePoint → SSO → 메일).
 * ProbeResult 6개: tone = ok ? "ok" : "warn", detail = probe.detail.
 * mail: tone = failed24h > sent24h*0.1 ? "warn" : "ok",
 *       detail = successRate==null ? "발송 없음" : `${(rate*100).toFixed(1)}% (sent/total)`.
 * critical 임계는 PR① 범위에서 미사용 — 전부 ok/warn.
 */
function snapshotToHealthItems(
  snap: SystemHealthSnapshot,
): HealthGatewayItem[] {
  const probe = (
    label: string,
    p: SystemHealthSnapshot["graph"],
  ): HealthGatewayItem => ({
    label,
    tone: p.ok ? "ok" : "warn",
    detail: p.detail,
  });
  const { mail } = snap;
  const mailDetail =
    mail.successRate === null
      ? "발송 없음"
      : `${(mail.successRate * 100).toFixed(1)}% (${mail.sent24h}/${mail.sent24h + mail.failed24h})`;
  const mailItem: HealthGatewayItem = {
    label: "메일 발송률 (24h)",
    tone: mail.failed24h > mail.sent24h * 0.1 ? "warn" : "ok",
    detail: mailDetail,
  };
  return [
    probe("YouTube API Quota", snap.youtube),
    probe("Supabase Connection", snap.supabase),
    probe("Cron 자동화 엔진", snap.cron),
    probe("Microsoft Graph API", snap.graph),
    probe("SharePoint 드라이브", snap.sharepoint),
    probe("Microsoft SSO", snap.sso),
    mailItem,
  ];
}

/** ISO/ymd 문자열의 연도만 delta 만큼 shift (나머지 보존). null 통과. */
function shiftYmdYear(ymd: string | null, delta: number): string | null {
  if (!ymd) return null;
  const m = /^(\d{4})(.*)$/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[1]) + delta}${m[2]}`;
}
