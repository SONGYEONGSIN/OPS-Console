import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { listReceipts, getExtractStates } from "@/features/postal/queries";
import { PostalClient } from "./_components/PostalClient";

/**
 * 우편물 — 등기발송 영수증 보관.
 *
 * 영수증을 A4에 풀칠하고 등기번호를 손으로 엑셀에 옮겨 적던 일을 화면으로 옮긴다.
 * 2단계에서 판독을 붙였다 — 회사 PC 폴러가 영수증을 읽고, 사람이 검토해 확정한다.
 * 엑셀 자동 기록은 3단계.
 */
export default async function PostalPage() {
  const slug = "postal";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;

  const receipts = await listReceipts();
  // 판독 상태를 한 번에 읽는다 — 카드마다 조회하면 총괄장을 그만큼 다시 읽는다.
  const extractStates = await getExtractStates(receipts.map((r) => r.id));
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
        <PostalClient
          receipts={receipts}
          extractStates={Object.fromEntries(extractStates)}
        />
      </div>
    </>
  );
}
