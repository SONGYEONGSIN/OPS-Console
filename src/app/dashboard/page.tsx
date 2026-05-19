import { getCurrentOperator } from "@/features/auth/queries";
import { getMenuCounts, getMineCounts } from "@/features/menu-counts/queries";
import { listServices } from "@/features/services/queries";
import { listWorklog } from "@/features/worklog/queries";
import { LivePageHeader } from "./_components/live/LivePageHeader";
import { HeroCard } from "./_components/live/HeroCard";
import { StatTile } from "./_components/live/StatTile";
import { ActivityFeed } from "./_components/live/ActivityFeed";

const KST_NOON = (ymd: string) => new Date(`${ymd}T12:00:00+09:00`);
const KST_TODAY_YMD = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );

function daysUntil(ymd: string): number {
  const today = KST_NOON(KST_TODAY_YMD()).getTime();
  const target = KST_NOON(ymd).getTime();
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

function formatHm(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/**
 * /dashboard 실시간 현황 — Apple Stocks/Health 톤 위젯 그리드.
 * 다른 메뉴(PageHeader breadcrumb/탭/메타) 패턴 미사용 — 실시간 현황 고유 디자인.
 * chrome(사이드바·종·탭)은 layout이 유지 — 메인 컨텐츠 영역만 위젯 톤.
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

  // mine=true → me 소유 카운트만, mine=false → 전체 카운트
  const counts = mine ? await getMineCounts(myEmail) : await getMenuCounts(myEmail);

  // 마감 임박 — services.write_end_at 가장 가까운 1건 (전체 또는 내 담당)
  const SERVICES_FETCH = 200;
  const { rows: allServices } = await listServices({
    sort: "write_end_asc",
    pageSize: SERVICES_FETCH,
  });
  const today = KST_TODAY_YMD();
  const candidateServices = allServices
    .filter((s) => s.write_end_at && s.write_end_at.slice(0, 10) >= today)
    .filter((s) => (mine && myEmail ? s.operator_email === myEmail : true));
  const nearestService = candidateServices[0];
  const nearestDn =
    nearestService && nearestService.write_end_at
      ? daysUntil(nearestService.write_end_at.slice(0, 10))
      : null;

  // 최근 활동 (worklog 10건). mine=true 시 본인 활동만.
  const { rows: worklog } = await listWorklog({
    pageSize: 10,
    userEmail: mine && myEmail ? myEmail : undefined,
  });
  const activityItems = worklog.map((w) => ({
    id: w.id,
    ts: formatHm(w.created_at),
    who: w.user_name ?? w.user_email ?? "—",
    what: w.msg,
  }));

  // hero — mine=false면 미수채권(sheet 기반, mine 불가), mine=true면 본인 인수인계
  const heroCards = [
    {
      kicker: "마감 임박",
      primary: nearestDn !== null ? `D${nearestDn >= 0 ? "-" : "+"}${Math.abs(nearestDn)}` : "—",
      title: nearestService?.university_name ?? "임박 일정 없음",
      subtitle: nearestService?.service_name ?? "currently 정상",
      tone:
        nearestDn !== null && nearestDn <= 3 ? ("urgent" as const) : ("neutral" as const),
    },
    mine
      ? {
          kicker: "내 인수인계",
          primary:
            counts.get("handover") != null ? `${counts.get("handover")}건` : "—",
          title: "registered",
          subtitle: "내가 작성자",
          tone: "neutral" as const,
        }
      : {
          kicker: "미수채권",
          primary:
            counts.get("receivables") != null ? `${counts.get("receivables")}건` : "—",
          title: "pending",
          subtitle: "registered total",
          tone: "neutral" as const,
        },
  ];

  // tiles — mine 가능 도메인(services/handover/incidents/backup/schedule/my-todo)은 항상 표시,
  // mine 불가 도메인(contracts/receivables/contacts)은 mine=true 시 hide.
  type Tile = { label: string; value: number | string; sub: string; href?: string };
  const mineTiles: Tile[] = [
    { label: "서비스", value: counts.get("services") ?? "—", sub: mine ? "내 담당" : "active", href: "/dashboard/services" },
    { label: "인수인계", value: counts.get("handover") ?? "—", sub: mine ? "내가 작성자" : "records", href: "/dashboard/handover" },
    { label: "사고", value: counts.get("incidents") ?? "—", sub: mine ? "내가 등록/담당" : "registered", href: "/dashboard/incidents" },
    { label: "백업 요청", value: counts.get("backup") ?? "—", sub: mine ? "내가 요청/백업자" : "registered", href: "/dashboard/backup" },
    { label: "내 할 일", value: counts.get("my-todo") ?? "—", sub: "assigned to me", href: "/dashboard/my-todo" },
    { label: "운영부 일정", value: counts.get("schedule") ?? "—", sub: mine ? "내 일정" : "events", href: "/dashboard/schedule" },
  ];
  const allOnlyTiles: Tile[] = [
    { label: "계약", value: counts.get("contracts") ?? "—", sub: "registered", href: "/dashboard/contracts" },
    { label: "대학연락처", value: counts.get("contacts") ?? "—", sub: "registered", href: "/dashboard/contacts" },
  ];
  const tiles: Tile[] = mine ? mineTiles : [...mineTiles, ...allOnlyTiles];

  return (
    <div className="flex h-full flex-col">
      <LivePageHeader mine={mine} title="실시간 현황" />
      <div className="flex-1 overflow-y-auto bg-washi-raised px-6 py-6">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
          {/* Hero — 큰 카드 2개 */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {heroCards.map((h, i) => (
              <HeroCard key={i} {...h} />
            ))}
          </section>

          {/* StatTile — 도메인 카운트 작은 타일 */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {tiles.map((t) => (
              <StatTile key={t.label} {...t} />
            ))}
          </section>

          {/* 최근 활동 */}
          <section className="border border-line bg-cream p-5">
            <div className="mb-3 flex items-baseline justify-between border-b border-line-soft pb-2">
              <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">
                최근 활동
              </h2>
              <span className="text-2xs uppercase tracking-[0.14em] text-muted">
                worklog · 10건
              </span>
            </div>
            <ActivityFeed items={activityItems} />
          </section>
        </div>
      </div>
    </div>
  );
}
