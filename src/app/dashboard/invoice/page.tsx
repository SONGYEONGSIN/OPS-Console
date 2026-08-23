import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listClosing } from "@/features/closing/queries";
import {
  fetchInvoiceStates,
  listSettledServiceIds,
} from "@/features/invoice/queries";
import { toInvoiceRows } from "@/features/invoice/rows";
import { InvoiceTable } from "./InvoiceTable";
import { ClosingStatusChips } from "../closing/_StatusChips";
import { ListPagination } from "@/components/common/ListPagination";

/**
 * 계산서발행 — **정산이 끝난 건**에 발행 기록을 남긴다.
 *
 * 목록 범위가 이 메뉴의 존재 이유다. 서비스마감·전형료정산은 결제가 끝난 572건을
 * 같이 보지만, 여기는 그중 **정산완료 표시가 된 것만** 본다. 정산 전 건이 섞이면
 * 아직 청구하면 안 되는 대학에 계산서가 나간다.
 *
 * `service_billing` 과 `closing_services` 는 FK 가 없어(스크랩 미러) DB 조인을 못
 * 건다. 그래서 정산완료 ID 를 먼저 받아 목록 쿼리에 넘긴다.
 */
export default async function InvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const slug = "invoice";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;

  const sp = await searchParams;
  const me = await getCurrentOperator();
  // 기본은 '내 것' — 정산과 같은 어법이다.
  const mine = sp.status !== "all";

  const settledIds = await listSettledServiceIds();

  const [{ rows: services, total }, allCount, mineCount] = await Promise.all([
    listClosing({
      page: sp.page ? Number(sp.page) : 1,
      pageSize: 30,
      search: sp.q,
      phase: "closed",
      operatorName: mine ? (me?.displayName ?? "") : undefined,
      serviceIds: settledIds,
    }),
    // 카운트도 같은 범위(정산완료) 안에서 센다 — 범위 밖 숫자가 뜨면 눌렀을 때
    // 그만큼 안 나와 화면이 거짓말한다.
    listClosing({
      search: sp.q,
      phase: "closed",
      pageSize: 1,
      serviceIds: settledIds,
    }).then((r) => r.total),
    listClosing({
      search: sp.q,
      phase: "closed",
      operatorName: me?.displayName ?? "",
      pageSize: 1,
      serviceIds: settledIds,
    }).then((r) => r.total),
  ]);

  const states = await fetchInvoiceStates(services.map((s) => s.service_id));
  const rows = toInvoiceRows(services, states);
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
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="flex items-baseline gap-2">
                <h3 className="text-xl font-bold text-ink">계산서 발행</h3>
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
          <InvoiceTable rows={rows} />
          <div className="mt-4">
            <ListPagination total={total} pageSize={30} />
          </div>
        </section>
      </div>
    </>
  );
}
