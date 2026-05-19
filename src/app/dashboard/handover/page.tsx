import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ScopeChips } from "@/components/common/ScopeChips";
import { ListPagination } from "@/components/common/ListPagination";
import { HandoverTabs } from "./HandoverTabs";
import { HandoverControls } from "./HandoverControls";
import { HandoverWizard } from "./HandoverWizard";
import { HandoverHistory } from "./HandoverHistory";
import { getCurrentOperator } from "@/features/auth/queries";
import { listOperators } from "@/features/operators/queries";
import { requireMenu } from "@/features/auth/menu-guard";
import {
  listServicesWithHandover,
  type HandoverListRow,
} from "@/features/handover/queries";
import {
  listHandoverProgress,
  listReadyServices,
} from "@/features/handover/progress-queries";
import { upsertHandoverRecord } from "@/features/handover/actions";
import type { HandoverStatus } from "@/features/handover/schemas";
import type { HandoverProgressStatus } from "@/features/handover/progress-schemas";

const PAGE_SIZE = 30;

type SearchParams = {
  q?: string;
  status?: string;
  page?: string;
  tab?: string;
  mine?: string;
};

export default async function HandoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const slug = "handover";
  await requireMenu(slug);

  const params = await searchParams;
  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const tab = params.tab ?? "content";

  const me = await getCurrentOperator();

  if (tab === "progress") {
    const fallback = resolvePageMeta(slug, meta);
    const ready = await listReadyServices();
    const ops = await listOperators();
    const operatorCandidates = ops
      .filter((o) => o.status === "active" && o.email !== me?.email)
      .map((o) => ({
        email: o.email,
        name: o.name,
        team: o.team,
        role: o.role,
      }));
    return (
      <div>
        <PageHeader
          pathname={pathname}
          meta={fallback.meta}
          headline={fallback.headline}
          description={fallback.description}
        />
        <HandoverTabs />
        <HandoverWizard
          services={ready}
          operators={operatorCandidates}
        />
      </div>
    );
  }

  if (tab === "history") {
    const fallback = resolvePageMeta(slug, meta);
    const mineHist = params.mine === "true";
    const statusHist = params.status as HandoverProgressStatus | undefined;
    const pageHist = Math.max(1, Number(params.page) || 1);
    const { rows: progressRows } = await listHandoverProgress({
      q: params.q,
      status: statusHist,
      toEmail: mineHist ? me?.email : undefined,
      page: pageHist,
      pageSize: PAGE_SIZE,
    });
    return (
      <div>
        <PageHeader
          pathname={pathname}
          meta={fallback.meta}
          headline={fallback.headline}
          description={fallback.description}
        />
        <HandoverTabs />
        <div className="p-7">
          <HandoverHistory rows={progressRows} meEmail={me?.email ?? null} />
        </div>
      </div>
    );
  }

  const page = Math.max(1, Number(params.page) || 1);
  const statusParam = params.status as HandoverStatus | "none" | undefined;
  const mine = params.mine === "true";
  const { rows: dbRows, total } = await listServicesWithHandover({
    q: params.q,
    status: statusParam,
    ownerEmail: mine ? me?.email : undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const rows: ListRow[] = dbRows.map(handoverToListRow);
  const config = resolvePageMeta(slug, meta, total);

  const header = (
    <div key="handover-header">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
      <HandoverTabs />
    </div>
  );
  const controlsRow = <HandoverControls key="handover-controls" />;

  async function onPersist(
    row: ListRow,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const r = await upsertHandoverRecord({
      service_id: row.id,
      contract_info_md: row.handoverContractInfoMd ?? null,
      contract_data_md: row.handoverContractDataMd ?? null,
      work_basic_md: row.handoverWorkBasicMd ?? null,
      work_generator_md: row.handoverWorkGeneratorMd ?? null,
      work_site_md: row.handoverWorkSiteMd ?? null,
      work_output_md: row.handoverWorkOutputMd ?? null,
      work_rate_md: row.handoverWorkRateMd ?? null,
      work_file_md: row.handoverWorkFileMd ?? null,
      work_etc_md: row.handoverWorkEtcMd ?? null,
      payment_fee_md: row.handoverPaymentFeeMd ?? null,
      payment_invoice_md: row.handoverPaymentInvoiceMd ?? null,
      school_contact_md: row.handoverSchoolContactMd ?? null,
      docs_md: row.handoverDocsMd ?? null,
      notes_md: row.handoverNotesMd ?? null,
    });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  return (
    <ListPattern
      title="서비스"
      data={{ rows }}
      header={header}
      controlsRow={controlsRow}
      variant="handover"
      canCreate={false}
      currentUserName={me?.displayName ?? me?.email ?? ""}
      inlineFilters={
        <ScopeChips
          key="handover-scope"
          total={total}
          mineLabel="내 서비스"
        />
      }
      footer={
        <ListPagination
          key="handover-pagination"
          total={total}
          pageSize={PAGE_SIZE}
        />
      }
      onPersist={onPersist}
    />
  );
}

function handoverToListRow(r: HandoverListRow): ListRow {
  return {
    id: r.service_id,
    name: `${r.university_name} · ${r.service_name}`,
    status: "active",
    owner: r.operator_name ?? "—",
    universityName: r.university_name,
    serviceName: r.service_name,
    applicationType: r.application_type,
    handoverServiceNumber: r.service_number,
    handoverStatus: r.handover_status ?? undefined,
    handoverContractInfoMd: r.contract_info_md,
    handoverContractDataMd: r.contract_data_md,
    handoverWorkBasicMd: r.work_basic_md,
    handoverWorkGeneratorMd: r.work_generator_md,
    handoverWorkSiteMd: r.work_site_md,
    handoverWorkOutputMd: r.work_output_md,
    handoverWorkRateMd: r.work_rate_md,
    handoverWorkFileMd: r.work_file_md,
    handoverWorkEtcMd: r.work_etc_md,
    handoverPaymentFeeMd: r.payment_fee_md,
    handoverPaymentInvoiceMd: r.payment_invoice_md,
    handoverSchoolContactMd: r.school_contact_md,
    handoverDocsMd: r.docs_md,
    handoverNotesMd: r.notes_md,
  };
}
