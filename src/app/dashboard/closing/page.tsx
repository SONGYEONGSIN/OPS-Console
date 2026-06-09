import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { requireMenu } from "@/features/auth/menu-guard";
import { listClosing } from "@/features/closing/queries";
import { closingRowToListRow } from "./_row-mapper";
import { ClosingStatusChips } from "./_StatusChips";

/**
 * /dashboard/closing — 서비스 마감 (Moa 스크래핑 적재, 읽기 전용).
 * services variant를 재사용해 동일한 표/인스펙터 구성. 편집/생성 없음(readOnly).
 */
export default async function ClosingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const slug = "closing";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const sp = await searchParams;
  const closedStatus =
    sp.status === "open" || sp.status === "all" ? sp.status : "closed"; // 기본 마감
  const { rows: closing, total } = await listClosing({
    page: sp.page ? Number(sp.page) : 1,
    pageSize: 30,
    closedStatus,
  });
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
      <div className="mt-2 border-b border-line-soft pb-1">
        <ClosingStatusChips />
      </div>
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
      footer={
        <ListPagination key="closing-pagination" total={total} pageSize={30} />
      }
    />
  );
}
