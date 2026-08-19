import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { listReceipts } from "@/features/postal/queries";
import { PostalClient } from "./_components/PostalClient";

/**
 * 우편물 — 등기발송 영수증 보관.
 *
 * 영수증을 A4에 풀칠하고 등기번호를 손으로 엑셀에 옮겨 적던 일을 화면으로 옮긴다.
 * 1단계는 보관까지다 — 추출·엑셀 기록은 다음 단계에서 붙인다.
 */
export default async function PostalPage() {
  const slug = "postal";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;

  const receipts = await listReceipts();
  const config = resolvePageMeta(slug, meta, receipts.length);

  return (
    <>
      <PageHeader
        pathname={`/dashboard/${slug}`}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <div className="p-5 lg:p-7">
        <PostalClient receipts={receipts} />
      </div>
    </>
  );
}
