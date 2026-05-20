import { getCurrentOperator } from "@/features/auth/queries";
import { listServices } from "@/features/services/queries";
import type { ServicesRow } from "@/features/services/schemas";
import { listIncidents } from "@/features/incidents/queries";
import { listContracts } from "@/features/contracts/queries";
import { listContacts } from "@/features/contacts/queries";
import { listBackupRequests } from "@/features/backup-requests/queries";
import { listScheduleEvents } from "@/features/schedule/queries";
import { fetchReceivablesSheet } from "@/features/receivables/queries";
import { listMyTodos } from "@/features/todos/queries";
import { listWorklog } from "@/features/worklog/queries";
import { servicesRowToListRow } from "./services/_row-mapper";
import { incidentToListRow } from "./incidents/_row-mapper";
import { contractsRowToListRow } from "./contracts/_row-mapper";
import { contactRowToListRow } from "./contacts/_row-mapper";
import { eventToListRow } from "./schedule/_row-mapper";
import { todoToListRow } from "./my-todo/_row-mapper";
import {
  receivablesToListRow,
  isReceivablesDataRow,
} from "./receivables/_row-mapper";
import { LiveDashboard } from "./_components/live/LiveDashboard";
import type {
  LiveCardConfig,
  LiveGroupConfig,
} from "./_components/live/LiveDashboard";
import type { ListRow } from "./_components/patterns/ListPattern";

/**
 * /dashboard 실시간 현황 — 영역(그룹)별 위젯 그리드.
 *
 * 그룹 3개:
 * - 요청·자료: 사고 / 백업 요청 / 대학연락처
 * - 서비스 사이클: 서비스 / 계약 / (예비 placeholder)
 * - 개인·활동: 내 할 일 / 운영부 일정 / 업무 활동 로그
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
  // 오픈 예정 — write_start_at >= today, 가까운 순. 1차 PR에서 client 측 정렬
  // (listServices에는 아직 write_start_asc 옵션 없음).
  const servicesUpcomingAll = allServices
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
  const servicesSimple = servicesUpcoming.map((s) => ({
    id: s.id,
    date: formatDateShort(s.write_start_at),
    title: `${s.university_name} · ${s.service_name}`,
  }));

  // ─── 사고 ─────────────────────────────────────────────
  const { rows: incidents, total: incidentsTotal } = await listIncidents({
    pageSize: 5,
    mine: mine && !!myEmail,
    meEmail: myEmail ?? undefined,
  });
  const incidentsListRows: ListRow[] = incidents.map(incidentToListRow);
  const incidentsSimple = incidents.map((i) => ({
    id: i.id,
    date: formatDateShort(i.occurred_date ?? i.created_at),
    title: i.title,
  }));

  // ─── 미수채권 (시트 fetch — 미입금 우선, 최근 5건) ─────────────
  let receivablesListRows: ListRow[] = [];
  let receivablesCount: number | null = null;
  let receivablesSimple: {
    id: string;
    date: string;
    name: string;
    amount: string;
  }[] = [];
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
      const top =
        pendingAll.length > 0 ? pendingAll.slice(0, 5) : filtered.slice(0, 5);
      receivablesListRows = top;
      receivablesSimple = top.map((r) => ({
        id: r.id,
        date: (r.meta ?? "").trim() || "—",
        name: r.name || "—",
        amount: (r.author ?? "").trim() || "—",
      }));
    }
  } catch {
    /* sheet fetch fail */
  }

  // ─── 계약 (시트 fetch) ──────────────────────────────────────
  // 계약은 일자 없음 — 도메인 컬럼: 구분(sheet) / 대학명(name) / 계약여부(status)
  let contractsListRows: ListRow[] = [];
  let contractsCount: number | null = null;
  let contractsSimple: {
    id: string;
    sheet: string;
    name: string;
    status: string;
  }[] = [];
  try {
    const { rows: contractRows } = await listContracts();
    const filtered = contractRows.filter((r) =>
      mine && me?.displayName ? r.operator === me.displayName : true,
    );
    contractsCount = filtered.length;
    const recent = filtered.slice(0, 5);
    contractsListRows = recent.map(contractsRowToListRow);
    contractsSimple = recent.map((r) => ({
      id: r.id,
      sheet: r.sheet,
      name: r.name,
      status: r.status || "—",
    }));
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
  const { rows: contacts, total: contactsTotal } = await listContacts({
    pageSize: 5,
    sort: "created_desc",
    universityIn: myUniversities,
  });
  const contactsListRows: ListRow[] = contacts.map(contactRowToListRow);
  const contactsSimple = contacts.map((c) => ({
    id: c.id,
    date: c.job_title ?? "—",
    title: `${c.customer_name} · ${c.university_name}`,
  }));

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
  const backupsSimple = backupsFiltered.slice(0, 5).map((b) => ({
    id: b.id,
    date: formatDateShort(b.created_at),
    title: b.summary_md.slice(0, 30),
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
  const scheduleSimple = upcomingEvents.map((e) => ({
    id: e.id,
    date: formatDateShort(e.start_at),
    title: e.title,
  }));

  // ─── 내 할 일 ─────────────────────────────────────────────
  const undoneTodos = (await listMyTodos()).filter((t) => !t.done);
  const todosCount = undoneTodos.length;
  const todos = undoneTodos.slice(0, 5);
  const todosListRows: ListRow[] = todos.map(todoToListRow);
  const todosSimple = todos.map((t) => ({
    id: t.id,
    date: t.due_at ? formatDateShort(t.due_at) : "—",
    title: t.title,
  }));

  // ─── 업무 활동 로그 ────────────────────────────────────────
  const { rows: worklog } = await listWorklog({
    pageSize: 5,
    userEmail: mine && myEmail ? myEmail : undefined,
  });
  // worklog는 list-variant 없음 — variant=default로 InspectorListBody fallback.
  // 클릭 시 ServicesView fallback 표시되나 정보 빈약. 비활성 의도지만 1차 PR엔
  // LiveCard 그대로 사용 (Card UI 통일). follow-up: ActivityRowCard로 분리.
  const worklogListRows: ListRow[] = worklog.map((w) => ({
    id: w.id,
    name: w.msg,
    status: "active",
    owner: w.user_name ?? w.user_email ?? "—",
    meta: w.level,
  }));
  const worklogSimple = worklog.map((w) => ({
    id: w.id,
    date: formatHm(w.created_at),
    title: `${w.user_name ?? w.user_email ?? "—"} · ${w.msg}`,
  }));

  // ─── 카드 빌더 ──────────────────────────────────────────
  const dateTitleColumns = [
    { key: "date", label: "일자", width: "w-20" },
    { key: "title", label: "내용" },
  ];

  // count는 해당 카드 리스트의 실제 모수 (헤더 숫자 ↔ 리스트 기준 일치)
  const card = (
    label: string,
    count: number | null,
    countSubAll: string,
    countSubMine: string,
    variant: LiveCardConfig["variant"],
    simpleRows: { id: string; date: string; title: string }[],
    listRows: ListRow[],
  ): LiveCardConfig => ({
    label,
    count,
    countSub: mine ? countSubMine : countSubAll,
    variant,
    columns: dateTitleColumns,
    simpleRows,
    listRowsById: idMap(listRows),
  });

  // ─── 그룹 ─────────────────────────────────────────────
  const groups: LiveGroupConfig[] = [
    {
      label: "서비스 사이클",
      description: "서비스·계약·미수채권",
      cards: [
        {
          label: "서비스",
          // 헤더 카운트 = 오픈 예정 건수 (리스트 기준과 일치)
          count: servicesUpcomingCount,
          countSub: mine ? "내 담당 · 오픈 예정" : "오픈 예정",
          variant: "services",
          columns: dateTitleColumns,
          simpleRows: servicesSimple,
          listRowsById: idMap(servicesListRows),
        },
        {
          label: "계약",
          count: contractsCount,
          countSub: mine ? "내 계약" : "registered",
          variant: "contracts",
          // 계약은 일자 없음 — 도메인 컬럼 사용
          columns: [
            { key: "sheet", label: "구분", width: "w-20" },
            { key: "name", label: "대학명" },
            { key: "status", label: "계약여부", width: "w-24" },
          ],
          simpleRows: contractsSimple,
          listRowsById: idMap(contractsListRows),
        },
        {
          label: "미수채권",
          count: receivablesCount,
          countSub: mine ? "내 발송" : "pending",
          variant: "receivables",
          // 청구일자 / 거래처 / 청구금액 (도메인 컬럼)
          columns: [
            { key: "date", label: "청구일자", width: "w-24" },
            { key: "name", label: "거래처" },
            { key: "amount", label: "청구금액", width: "w-24", alignRight: true },
          ],
          simpleRows: receivablesSimple,
          listRowsById: idMap(receivablesListRows),
        },
      ],
    },
    {
      label: "요청 · 자료",
      description: "사고·백업·연락처",
      cards: [
        card(
          "사고",
          incidentsTotal,
          "registered",
          "내가 등록/담당",
          "incidents",
          incidentsSimple,
          incidentsListRows,
        ),
        card(
          "백업 요청",
          backupCount,
          "registered",
          "내가 요청/백업자",
          "backup",
          backupsSimple,
          backupListRows,
        ),
        card(
          "대학연락처",
          contactsTotal,
          "registered",
          "내 대학 연락처",
          "contacts",
          contactsSimple,
          contactsListRows,
        ),
      ],
    },
    {
      label: "개인 · 활동",
      description: "할 일·일정·활동 로그",
      cards: [
        card(
          "내 할 일",
          todosCount,
          "미완",
          "미완",
          "my-todo",
          todosSimple,
          todosListRows,
        ),
        card(
          "운영부 일정",
          scheduleCount,
          "예정",
          "내 일정 · 예정",
          "schedule",
          scheduleSimple,
          scheduleListRows,
        ),
        card(
          "업무 활동 로그",
          worklog.length,
          "최근",
          "내 활동",
          "default",
          worklogSimple,
          worklogListRows,
        ),
      ],
    },
  ];

  return <LiveDashboard mine={mine} groups={groups} />;
}

function formatDateShort(iso?: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  }).format(new Date(iso));
}

function formatHm(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function idMap(rows: ListRow[]): Record<string, ListRow> {
  const map: Record<string, ListRow> = {};
  for (const r of rows) map[r.id] = r;
  return map;
}
