import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { listReceipts, getExtractStates } from "@/features/postal/queries";
import { fetchPettyCash } from "@/features/petty-cash/queries";
import { PageTabs } from "@/components/common/PageTabs";
import { PettyCashPanel } from "./_components/PettyCashPanel";
import { PostalClient } from "./_components/PostalClient";
import { loadLedgerView, EMPTY_LEDGER } from "@/features/postal/ledger-load";
import { getPostalWorkbookLinks } from "@/features/postal/workbook-links";
import { POSTAL_TABS } from "./tabs";

/**
 * 우편물 — 등기발송 영수증 보관.
 *
 * 영수증을 A4에 풀칠하고 등기번호를 손으로 엑셀에 옮겨 적던 일을 화면으로 옮긴다.
 * 2단계에서 판독을 붙였다 — 회사 PC 폴러가 영수증을 읽고, 사람이 검토해 확정한다.
 * 엑셀 자동 기록은 3단계.
 */
export default async function PostalPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; year?: string }>;
}) {
  const slug = "postal";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;

  const sp = await searchParams;
  const tab = sp.tab === "petty" ? "petty" : "receipts";

  // 보고 있는 탭만 읽는다 — 전도금은 Graph 호출이라 안 볼 때 부를 이유가 없다.
  const receipts = tab === "receipts" ? await listReceipts() : [];
  // 판독 상태를 한 번에 읽는다 — 카드마다 조회하면 총괄장을 그만큼 다시 읽는다.
  const extractStates =
    tab === "receipts"
      ? await getExtractStates(receipts.map((r) => r.id))
      : new Map();
  const pettyCash = tab === "petty" ? await fetchPettyCash() : null;
  // 대장이 이 탭의 주인공이다. 읽기가 실패해도 화면은 뜨게 하고 이유를 함께 넘긴다 —
  // 빈 표를 그리면 "발송이 없다"로 읽힌다.
  const ledger =
    tab === "receipts"
      ? await loadLedgerView(Number(sp.year) || undefined)
      : EMPTY_LEDGER;
  // 원본 엑셀 바로가기 — 실패해도 null로 와서 버튼만 안 뜬다(목록은 그대로).
  const links = await getPostalWorkbookLinks();
  const config = resolvePageMeta(slug, meta, receipts.length);

  return (
    <>
      <PageHeader
        pathname={`/dashboard/${slug}`}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <PageTabs active={tab} tabs={POSTAL_TABS} />
      <div className="p-5 lg:p-7">
        {tab === "petty" ? (
          <PettyCashPanel sheet={pettyCash} pettyCashUrl={links.pettyCashUrl} />
        ) : (
          <PostalClient
            receipts={receipts}
            extractStates={Object.fromEntries(extractStates)}
            ledger={ledger}
            ledgerUrl={links.ledgerUrl}
          />
        )}
      </div>
    </>
  );
}
