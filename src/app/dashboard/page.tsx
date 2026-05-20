import { getCurrentOperator } from "@/features/auth/queries";
import { getMenuCounts, getMineCounts } from "@/features/menu-counts/queries";
import { listServices } from "@/features/services/queries";
import { listIncidents } from "@/features/incidents/queries";
import { listContracts } from "@/features/contracts/queries";
import { servicesRowToListRow } from "./services/_row-mapper";
import { incidentToListRow } from "./incidents/_row-mapper";
import { contractsRowToListRow } from "./contracts/_row-mapper";
import { LiveDashboard } from "./_components/live/LiveDashboard";
import type { LiveCardConfig } from "./_components/live/LiveDashboard";
import type { ListRow } from "./_components/patterns/ListPattern";

/**
 * /dashboard 실시간 현황 — 3-column 위젯 그리드.
 * 도메인별 카드(라벨+카운트+최근 5건 mini-table) + row 클릭 시 우측 인스펙터.
 * 다른 메뉴 PageHeader 패턴 미사용. chrome은 layout이 유지.
 *
 * 1차 PR: services / incidents / contracts 3 도메인.
 * follow-up: handover / receivables / backup / contacts / schedule.
 */
export default async function DashboardLivePage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const sp = await searchParams;
  const mine = sp.mine === "true";

  const me = await getCurrentOperator();
  const myEmail = me?.email ?? null;

  const counts = mine
    ? await getMineCounts(myEmail)
    : await getMenuCounts(myEmail);

  // services 최근 5건 (write_end_asc + 오늘 이후)
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
  const servicesListRows: ListRow[] = servicesUpcoming.map(servicesRowToListRow);
  const servicesSimple = servicesUpcoming.map((s) => ({
    id: s.id,
    date: formatDateShort(s.write_end_at),
    title: `${s.university_name} · ${s.service_name}`,
  }));

  // incidents 최근 5건
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

  // contracts 최근 5건 (시트 fetch — 페이지네이션 없으므로 client slice)
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
    // 시트 fetch 실패 — 빈 상태로 표시
  }

  const cards: LiveCardConfig[] = [
    {
      label: "서비스",
      count: counts.get("services") ?? null,
      countSub: mine ? "내 담당" : "active",
      variant: "services",
      columns: [
        { key: "date", label: "마감", width: "w-20" },
        { key: "title", label: "대학·서비스" },
      ],
      simpleRows: servicesSimple,
      listRowsById: idMap(servicesListRows),
    },
    {
      label: "사고",
      count: counts.get("incidents") ?? null,
      countSub: mine ? "내가 등록/담당" : "registered",
      variant: "incidents",
      columns: [
        { key: "date", label: "발생", width: "w-20" },
        { key: "title", label: "사고 제목" },
      ],
      simpleRows: incidentsSimple,
      listRowsById: idMap(incidentsListRows),
    },
    {
      label: "계약",
      count: counts.get("contracts") ?? null,
      countSub: mine ? "내 계약" : "registered",
      variant: "contracts",
      columns: [
        { key: "date", label: "시트", width: "w-20" },
        { key: "title", label: "계약명" },
      ],
      simpleRows: contractsSimple,
      listRowsById: idMap(contractsListRows),
    },
  ];

  return <LiveDashboard mine={mine} cards={cards} />;
}

function formatDateShort(iso?: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  }).format(new Date(iso));
}

function idMap(rows: ListRow[]): Record<string, ListRow> {
  const map: Record<string, ListRow> = {};
  for (const r of rows) map[r.id] = r;
  return map;
}
