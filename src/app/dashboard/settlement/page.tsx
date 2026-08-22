import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listClosing } from "@/features/closing/queries";
import { fetchSettlementDeadlines } from "@/features/settlement/queries";
import { toSettlementRows } from "@/features/settlement/rows";
import { SettlementTable } from "./SettlementTable";
import { ClosingStatusChips } from "../closing/_StatusChips";
import { ListPagination } from "@/components/common/ListPagination";

/**
 * 전형료 정산 — 결제가 끝난 서비스를 **정산 마감일** 기준으로 본다.
 *
 * 목록 자체는 서비스마감과 같다(`listClosing` 이 이미 `pay_end_at` 으로 거른다).
 * 다른 점은 **대학별 정산기한을 붙여 마감일과 남은 날을 만든다**는 것이다 —
 * 그게 없으면 이 메뉴는 서비스마감의 사본일 뿐이다.
 */
export default async function SettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const slug = "settlement";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;

  const sp = await searchParams;
  const me = await getCurrentOperator();
  // 기본은 '내 정산' — 처음 열었을 때 남의 것이 잔뜩 나오면 쓸모가 없다.
  const mine = sp.status !== "all";

  const [{ rows: services, total }, deadlines, allCount, mineCount] = await Promise.all([
    listClosing({
      page: sp.page ? Number(sp.page) : 1,
      pageSize: 30,
      search: sp.q,
      closedStatus: "closed",
      operatorName: mine ? (me?.displayName ?? "") : undefined,
    }),
    fetchSettlementDeadlines(),
    // 카운트는 정산 범위(결제 끝난 것) 안에서 센다 — 범위 밖 숫자가 뜨면
    // 눌렀을 때 그만큼 안 나와 화면이 거짓말한다.
    listClosing({ search: sp.q, closedStatus: "closed", pageSize: 1 }).then(
      (r) => r.total,
    ),
    listClosing({
      search: sp.q,
      closedStatus: "closed",
      operatorName: me?.displayName ?? "",
      pageSize: 1,
    }).then((r) => r.total),
  ]);

  const rows = toSettlementRows(services, deadlines);
  const config = resolvePageMeta(slug, meta, total);

  return (
    <>
      <PageHeader
        pathname={`/dashboard/${slug}`}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <div className="p-5 lg:p-7">
        <section>
          {/* 칩은 제목 바로 옆이다 — ListPattern 표준(제목·건수·칩이 한 묶음).
              justify-between 로 밀어내면 화면 반대편으로 가 무엇의 필터인지
              읽히지 않는다. */}
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="flex items-baseline gap-2">
                <h3 className="text-xl font-bold text-ink">전형료 정산</h3>
                <span className="text-muted" aria-hidden>
                  ·
                </span>
                <span className="text-sm text-vermilion">{total}건</span>
              </div>
              <ClosingStatusChips
                counts={{ all: allCount, mine: mineCount }}
                scope="settlement"
              />
            </div>
          </header>
          <SettlementTable rows={rows} />
          <div className="mt-4">
            <ListPagination total={total} pageSize={30} />
          </div>
        </section>
      </div>
    </>
  );
}
