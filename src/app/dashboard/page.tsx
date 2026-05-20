import { getCurrentOperator } from "@/features/auth/queries";
import { getMenuCounts, getMineCounts } from "@/features/menu-counts/queries";
import { listServices } from "@/features/services/queries";
import { listIncidents } from "@/features/incidents/queries";
import { listContracts } from "@/features/contracts/queries";
import { listContacts } from "@/features/contacts/queries";
import { listBackupRequests } from "@/features/backup-requests/queries";
import { listScheduleEvents } from "@/features/schedule/queries";
import { listMyTodos } from "@/features/todos/queries";
import { listWorklog } from "@/features/worklog/queries";
import { servicesRowToListRow } from "./services/_row-mapper";
import { incidentToListRow } from "./incidents/_row-mapper";
import { contractsRowToListRow } from "./contracts/_row-mapper";
import { contactRowToListRow } from "./contacts/_row-mapper";
import { eventToListRow } from "./schedule/_row-mapper";
import { todoToListRow } from "./my-todo/_row-mapper";
import { LiveDashboard } from "./_components/live/LiveDashboard";
import { HeroCard } from "./_components/live/HeroCard";
import { StatTile } from "./_components/live/StatTile";
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

  const counts = mine
    ? await getMineCounts(myEmail)
    : await getMenuCounts(myEmail);

  // ─── 서비스 (마감 임박 5건) ─────────────────────────────────
  const todayYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
  }).format(new Date());
  const { rows: allServices } = await listServices({
    sort: "write_end_asc",
    pageSize: 200,
  });
  const servicesUpcoming = allServices
    .filter((s) => s.write_end_at && s.write_end_at.slice(0, 10) >= todayYmd)
    .filter((s) => (mine && myEmail ? s.operator_email === myEmail : true))
    .slice(0, 5);
  const servicesListRows: ListRow[] = servicesUpcoming.map(
    servicesRowToListRow,
  );
  const servicesSimple = servicesUpcoming.map((s) => ({
    id: s.id,
    date: formatDateShort(s.write_end_at),
    title: `${s.university_name} · ${s.service_name}`,
  }));

  // ─── 사고 ─────────────────────────────────────────────
  const { rows: incidents } = await listIncidents({
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

  // ─── 계약 (시트 fetch) ──────────────────────────────────────
  let contractsListRows: ListRow[] = [];
  let contractsSimple: { id: string; date: string; title: string }[] = [];
  try {
    const { rows: contractRows } = await listContracts();
    const recent = contractRows
      .filter((r) =>
        mine && me?.displayName ? r.operator === me.displayName : true,
      )
      .slice(0, 5);
    contractsListRows = recent.map(contractsRowToListRow);
    contractsSimple = recent.map((r) => ({
      id: r.id,
      date: r.sheet,
      title: r.name,
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
  const { rows: contacts } = await listContacts({
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
  const { rows: backups } = await listBackupRequests({ pageSize: 5 });
  const backupsFiltered = mine && myEmail
    ? backups.filter(
        (b) =>
          b.requester_email === myEmail || b.substitute_email === myEmail,
      )
    : backups;
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
  const upcomingEvents = events
    .filter((e) => new Date(e.start_at) >= todayDate)
    .filter((e) =>
      mine && myEmail
        ? e.assignee_email === myEmail || e.created_by_email === myEmail
        : true,
    )
    .slice(0, 5);
  const scheduleListRows: ListRow[] = upcomingEvents.map(eventToListRow);
  const scheduleSimple = upcomingEvents.map((e) => ({
    id: e.id,
    date: formatDateShort(e.start_at),
    title: e.title,
  }));

  // ─── 내 할 일 ─────────────────────────────────────────────
  const todos = (await listMyTodos()).filter((t) => !t.done).slice(0, 5);
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

  const card = (
    label: string,
    countKey: string,
    countSubAll: string,
    countSubMine: string,
    variant: LiveCardConfig["variant"],
    simpleRows: { id: string; date: string; title: string }[],
    listRows: ListRow[],
  ): LiveCardConfig => ({
    label,
    count: counts.get(countKey) ?? null,
    countSub: mine ? countSubMine : countSubAll,
    variant,
    columns: dateTitleColumns,
    simpleRows,
    listRowsById: idMap(listRows),
  });

  // ─── 그룹 ─────────────────────────────────────────────
  const groups: LiveGroupConfig[] = [
    {
      label: "요청 · 자료",
      description: "사고·백업·연락처",
      cards: [
        card(
          "사고",
          "incidents",
          "registered",
          "내가 등록/담당",
          "incidents",
          incidentsSimple,
          incidentsListRows,
        ),
        card(
          "백업 요청",
          "backup",
          "registered",
          "내가 요청/백업자",
          "backup",
          backupsSimple,
          backupListRows,
        ),
        card(
          "대학연락처",
          "contacts",
          "registered",
          "내 대학 연락처",
          "contacts",
          contactsSimple,
          contactsListRows,
        ),
      ],
    },
    {
      label: "서비스 사이클",
      description: "서비스·계약",
      cards: [
        card(
          "서비스",
          "services",
          "active",
          "내 담당",
          "services",
          servicesSimple,
          servicesListRows,
        ),
        card(
          "계약",
          "contracts",
          "registered",
          "내 계약",
          "contracts",
          contractsSimple,
          contractsListRows,
        ),
      ],
    },
    {
      label: "개인 · 활동",
      description: "할 일·일정·활동 로그",
      cards: [
        card(
          "내 할 일",
          "my-todo",
          "assigned to me",
          "오늘·미완",
          "my-todo",
          todosSimple,
          todosListRows,
        ),
        card(
          "운영부 일정",
          "schedule",
          "events",
          "내 일정",
          "schedule",
          scheduleSimple,
          scheduleListRows,
        ),
        card(
          "업무 활동 로그",
          "worklog",
          "logged",
          "내 활동",
          "default",
          worklogSimple,
          worklogListRows,
        ),
      ],
    },
  ];

  // ─── 상단 요약 (Hero + StatTile) ───────────────────────────
  const nearestService = servicesUpcoming[0];
  const nearestDn = nearestService?.write_end_at
    ? daysUntil(nearestService.write_end_at.slice(0, 10), todayYmd)
    : null;

  const summary = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <HeroCard
          kicker="마감 임박"
          primary={
            nearestDn !== null
              ? `D${nearestDn >= 0 ? "-" : "+"}${Math.abs(nearestDn)}`
              : "—"
          }
          title={nearestService?.university_name ?? "임박 일정 없음"}
          subtitle={nearestService?.service_name ?? "currently 정상"}
          tone={
            nearestDn !== null && nearestDn <= 3 ? "urgent" : "neutral"
          }
        />
        <HeroCard
          kicker="미수채권"
          primary={
            counts.get("receivables") != null
              ? `${counts.get("receivables")}건`
              : "—"
          }
          title="pending"
          subtitle="registered total"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <StatTile
          label="서비스"
          value={counts.get("services") ?? "—"}
          sub={mine ? "내 담당" : "active"}
          href="/dashboard/services"
        />
        <StatTile
          label="인수인계"
          value={counts.get("handover") ?? "—"}
          sub={mine ? "내가 작성자" : "records"}
          href="/dashboard/handover"
        />
        <StatTile
          label="사고"
          value={counts.get("incidents") ?? "—"}
          sub={mine ? "내가 등록/담당" : "registered"}
          href="/dashboard/incidents"
        />
        <StatTile
          label="백업 요청"
          value={counts.get("backup") ?? "—"}
          sub={mine ? "내가 요청/백업자" : "registered"}
          href="/dashboard/backup"
        />
        <StatTile
          label="내 할 일"
          value={counts.get("my-todo") ?? "—"}
          sub="assigned to me"
          href="/dashboard/my-todo"
        />
        <StatTile
          label="운영부 일정"
          value={counts.get("schedule") ?? "—"}
          sub={mine ? "내 일정" : "events"}
          href="/dashboard/schedule"
        />
        <StatTile
          label="계약"
          value={counts.get("contracts") ?? "—"}
          sub={mine ? "내 계약" : "registered"}
          href="/dashboard/contracts"
        />
        <StatTile
          label="대학연락처"
          value={counts.get("contacts") ?? "—"}
          sub={mine ? "내 대학" : "registered"}
          href="/dashboard/contacts"
        />
      </div>
    </div>
  );

  return <LiveDashboard mine={mine} summary={summary} groups={groups} />;
}

function daysUntil(targetYmd: string, todayYmd: string): number {
  const today = new Date(`${todayYmd}T12:00:00+09:00`).getTime();
  const target = new Date(`${targetYmd}T12:00:00+09:00`).getTime();
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
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
