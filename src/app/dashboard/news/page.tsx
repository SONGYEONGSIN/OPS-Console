import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { requireMenu } from "@/features/auth/menu-guard";
import {
  listNews,
  listNewsSources,
  listNewsKeywords,
} from "@/features/news/queries";
import { newsRowToListRow } from "./_row-mapper";
import { NewsControls } from "./NewsControls";
import { NewsKeywordChips } from "./NewsKeywordChips";

const PAGE_SIZE = 30;

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    source?: string;
    keyword?: string;
  }>;
}) {
  const slug = "news";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;
  const [{ rows: news, total }, sources, keywords] = await Promise.all([
    listNews({
      page,
      pageSize: PAGE_SIZE,
      search: sp.q,
      source: sp.source,
      keyword: sp.keyword,
    }),
    listNewsSources(),
    listNewsKeywords(),
  ]);
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
      controlsRow={<NewsControls key="news-controls" sources={sources} />}
      inlineFilters={
        <NewsKeywordChips key="news-keyword-chips" keywords={keywords} />
      }
      footer={
        <ListPagination key="news-pagination" total={total} pageSize={PAGE_SIZE} />
      }
    />
  );
}
