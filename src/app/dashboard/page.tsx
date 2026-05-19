import { getCurrentOperator } from "@/features/auth/queries";
import { getMenuCounts } from "@/features/menu-counts/queries";
import { listServices } from "@/features/services/queries";
import { listWorklog } from "@/features/worklog/queries";
import { LiveFullscreen } from "./_components/live/LiveFullscreen";
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
 * /dashboard 실시간 현황 — 풀스크린 위젯 그리드.
 * Apple Stocks/Health 톤. chrome overlay 위 풀스크린, X로 탈출.
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

  // 도메인별 전체 카운트 (이미 layout에서 호출되지만 본 페이지에서도 직접 fetch)
  const counts = await getMenuCounts(myEmail);

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

  const heroCards = [
    {
      kicker: "마감 임박",
      primary: nearestDn !== null ? `D${nearestDn >= 0 ? "-" : "+"}${Math.abs(nearestDn)}` : "—",
      title: nearestService?.university_name ?? "임박 일정 없음",
      subtitle: nearestService?.service_name ?? "currently 정상",
      tone:
        nearestDn !== null && nearestDn <= 3 ? ("urgent" as const) : ("neutral" as const),
    },
    {
      kicker: "미수채권",
      primary: counts.get("receivables") != null ? `${counts.get("receivables")}건` : "—",
      title: "pending",
      subtitle: "registered total",
      tone: "neutral" as const,
    },
  ];

  // 도메인 카운트 타일 (Apple Health 톤)
  const tiles: Array<{ label: string; value: number | string; sub: string; href?: string }> = [
    { label: "서비스", value: counts.get("services") ?? "—", sub: "active", href: "/dashboard/services" },
    { label: "인수인계", value: counts.get("handover") ?? "—", sub: "records", href: "/dashboard/handover" },
    { label: "사고", value: counts.get("incidents") ?? "—", sub: "registered", href: "/dashboard/incidents" },
    { label: "계약", value: counts.get("contracts") ?? "—", sub: "registered", href: "/dashboard/contracts" },
    { label: "백업 요청", value: counts.get("backup") ?? "—", sub: "registered", href: "/dashboard/backup" },
    { label: "대학연락처", value: counts.get("contacts") ?? "—", sub: "registered", href: "/dashboard/contacts" },
    { label: "내 할 일", value: counts.get("my-todo") ?? "—", sub: "assigned to me", href: "/dashboard/my-todo" },
    { label: "운영부 일정", value: counts.get("schedule") ?? "—", sub: "events", href: "/dashboard/schedule" },
  ];

  return (
    <LiveFullscreen mine={mine} title="실시간 현황">
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
    </LiveFullscreen>
  );
}
