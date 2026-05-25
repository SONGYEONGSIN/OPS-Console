import Link from "next/link";
import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { requireMenu } from "@/features/auth/menu-guard";
import { listManualChildren } from "@/features/manuals/queries";
import { manualRowToListRow } from "./_row-mapper";

const PAGE_SIZE = 30;

export default async function ManualsPage({
  searchParams,
}: {
  searchParams: Promise<{ itemId?: string; q?: string; page?: string }>;
}) {
  const slug = "manuals";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const sp = await searchParams;
  const itemId = sp.itemId?.trim() || undefined;
  const all = await listManualChildren({ parentItemId: itemId ?? null });

  // 검색 — 이름 ilike (case-insensitive)
  const qRaw = (sp.q ?? "").trim();
  const qLower = qRaw.toLowerCase();
  const filtered = qRaw
    ? all.filter((r) => r.name.toLowerCase().includes(qLower))
    : all;
  const total = filtered.length;

  const page = Math.max(1, Number(sp.page) || 1);
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);
  const rows: ListRow[] = pageRows.map(manualRowToListRow);
  const config = resolvePageMeta(slug, meta, total);

  // 하위 폴더 진입 시 상위로 돌아가는 링크 (breadcrumb 대용)
  const inSubfolder = Boolean(itemId);
  const controlsRow = inSubfolder ? (
    <div
      key="manuals-controls"
      className="flex items-center gap-3 border-b border-line-soft bg-washi px-7 py-2 text-sm"
    >
      <Link
        href={pathname}
        className="text-vermilion hover:underline"
        aria-label="매뉴얼 루트로 이동"
      >
        ← 매뉴얼 루트로
      </Link>
      <span className="text-muted">하위 폴더 보기 중</span>
    </div>
  ) : null;

  const header = (
    <div key="manuals-header">
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
      variant="manual"
      canCreate={false}
      readOnly
      controlsRow={controlsRow ?? undefined}
      footer={
        <ListPagination
          key="manuals-pagination"
          total={total}
          pageSize={PAGE_SIZE}
        />
      }
    />
  );
}
