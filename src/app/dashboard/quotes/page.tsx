import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { ScopeChips } from "@/components/common/ScopeChips";
import { QuotesControls } from "./QuotesControls";
import { NewQuoteButton } from "./_components/NewQuoteButton";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listQuotes } from "@/features/quotes/queries";
import {
  createQuote,
  updateQuote,
  deleteQuote,
} from "@/features/quotes/actions";
import type { QuoteInput } from "@/features/quotes/schemas";
import { quoteStatusSchema } from "@/features/quotes/schemas";
import { quoteRowToListRow } from "./_row-mapper";

const PAGE_SIZE = 30;

type SearchParams = {
  page?: string;
  status?: string;
  q?: string;
};

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const slug = "quotes";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const sp = await searchParams;
  const me = await getCurrentOperator();
  const canEdit = me?.permission === "admin" || me?.permission === "member";

  const page = Math.max(1, Number(sp.page) || 1);

  // status 파라미터 검증 — 유효값만 통과
  const statusResult = quoteStatusSchema.safeParse(sp.status);
  const statusFilter = statusResult.success ? statusResult.data : undefined;

  const { rows: quotes, total } = await listQuotes({
    page,
    pageSize: PAGE_SIZE,
    status: statusFilter,
    search: sp.q || undefined,
  });

  const rows: ListRow[] = quotes.map(quoteRowToListRow);
  const config = resolvePageMeta(slug, meta, total);

  const header = (
    <div key="quotes-header">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
    </div>
  );
  const controlsRow = <QuotesControls key="quotes-controls" />;

  async function onPersist(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";

    // 삭제 신호
    if (row.status === "deleted") {
      const r = await deleteQuote(row.id);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }

    // ListRow → QuoteInput 역매핑
    const input: QuoteInput = {
      customer: row.quoteCustomer ?? "",
      quote_date: row.quoteDate ?? "",
      valid_until: row.quoteValidUntil ?? null,
      amount:
        row.quoteAmount != null ? Math.trunc(row.quoteAmount) : null,
      owner_email: row.quoteOwner ?? null,
      status: row.quoteStatus ?? "draft",
      note: row.quoteNote ?? null,
      quote_type: row.quoteType,
    };

    if (isNew) {
      const r = await createQuote(input);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    const r = await updateQuote(row.id, input);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="quotes"
      canCreate={canEdit}
      createLabel="+ 새 견적서"
      readOnly={!canEdit}
      currentUserPermission={me?.permission ?? null}
      currentUserEmail={me?.email ?? null}
      currentUserName={me?.displayName ?? me?.email ?? ""}
      controlsRow={controlsRow}
      extraActions={canEdit ? <NewQuoteButton /> : undefined}
      inlineFilters={
        <ScopeChips key="quotes-scope" total={total} mineLabel="내 견적서" />
      }
      footer={
        <ListPagination
          key="quotes-pagination"
          total={total}
          pageSize={PAGE_SIZE}
        />
      }
      onPersist={canEdit ? onPersist : undefined}
    />
  );
}
