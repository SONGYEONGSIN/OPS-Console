import { findSidebarMeta } from "../_data";
import { PAGE_META } from "../_data/page-meta-config";
import { derivePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { getPatternMockData } from "../_data/patterns";
import { getCurrentOperator } from "@/features/auth/queries";
import { canEditOperators } from "@/features/auth/permission";
import { requireMenu } from "@/features/auth/menu-guard";

/**
 * /dashboard/notices — 운영부 공지사항 게시판 (mock).
 * admin(부장·팀장)만 작성 가능, 모두 read. DB 영구 저장은 후속 epic.
 */
export default async function NoticesPage() {
  const slug = "notices";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = PAGE_META[slug] ?? derivePageMeta(slug, meta);
  const data = getPatternMockData(slug, "list") as { rows: ListRow[] };

  const me = await getCurrentOperator();
  const isAdmin = canEditOperators(me?.permission ?? null);

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
      variant="post-notice"
      canCreate={isAdmin}
      createLabel="+ 새 공지"
      readOnly={!isAdmin}
    />
  );
}
