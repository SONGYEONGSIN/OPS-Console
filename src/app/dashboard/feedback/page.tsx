import { findSidebarMeta } from "../_data";
import { PAGE_META } from "../_data/page-meta-config";
import { derivePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { getPatternMockData } from "../_data/patterns";

/**
 * /dashboard/feedback — 시스템 개선 요청 게시판 (mock).
 * 운영부 전원이 작성 가능. DB 영구 저장은 후속 epic.
 */
export default function FeedbackPage() {
  const slug = "feedback";
  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = PAGE_META[slug] ?? derivePageMeta(slug, meta);
  const data = getPatternMockData(slug, "list") as { rows: ListRow[] };

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
    />
  );

  return (
    <ListPattern
      title={meta.label}
      data={data}
      header={header}
      variant="post-feedback"
      canCreate
      createLabel="+ 새 개선 요청"
    />
  );
}
