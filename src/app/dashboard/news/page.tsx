import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { requireMenu } from "@/features/auth/menu-guard";
import { listNews } from "@/features/news/queries";
import { newsRowToListRow } from "./_row-mapper";

const PAGE_SIZE = 30;

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const slug = "news";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;
  const { rows: news, total } = await listNews({ page, pageSize: PAGE_SIZE });
  const rows: ListRow[] = news.map(newsRowToListRow);
  const config = resolvePageMeta(slug, meta, total);

  const header = (
    <div key="news-header">
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
      variant="news"
      readOnly
      liveData
      footer={
        <ListPagination key="news-pagination" total={total} pageSize={PAGE_SIZE} />
      }
    />
  );
}
