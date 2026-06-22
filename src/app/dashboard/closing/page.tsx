import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  listClosing,
  listClosingCategories,
  listClosingMonths,
} from "@/features/closing/queries";
import { closingRowToListRow } from "./_row-mapper";
import { ClosingStatusChips } from "./_StatusChips";
import { ClosingControls } from "./ClosingControls";

/**
 * /dashboard/closing — 서비스 마감 (Moa 스크래핑 적재, 읽기 전용).
 * services variant 재사용. 표준 toolbar: 검색·카테고리 셀렉트(controlsRow) + 마감여부 칩(inlineFilters).
 * 필터는 서버(listClosing)에서 적용 — search(q)·category·마감여부(status)·내 마감(operator_name).
 */
export default async function ClosingPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    q?: string;
    category?: string;
    month?: string;
  }>;
}) {
  const slug = "closing";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const sp = await searchParams;
  const me = await getCurrentOperator();

  // 칩(status) → 마감여부(closedStatus) + 내 마감(operatorName) 매핑. 기본 '내 마감'.
  const status =
    sp.status === "open" || sp.status === "all" ? sp.status : "mine";
  const closedStatus = status === "open" ? "open" : "all";
  const operatorName = status === "mine" ? (me?.displayName ?? "") : undefined;

  const [{ rows: closing, total }, categories, months] = await Promise.all([
    listClosing({
      page: sp.page ? Number(sp.page) : 1,
      pageSize: 30,
      search: sp.q,
      category: sp.category,
      month: sp.month,
      closedStatus,
      operatorName,
    }),
    listClosingCategories(),
    listClosingMonths(),
  ]);
  const rows: ListRow[] = closing.map(closingRowToListRow);
  const config = resolvePageMeta(slug, meta, total);

  const header = (
    <div key="closing-header">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
    </div>
  );

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="services"
      canCreate={false}
      readOnly
      liveData
      controlsRow={
        <ClosingControls
          key="closing-controls"
          categories={categories}
          months={months}
        />
      }
      inlineFilters={<ClosingStatusChips key="closing-scope" />}
      footer={
        <ListPagination key="closing-pagination" total={total} pageSize={30} />
      }
    />
  );
}
