import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ScopeChips } from "@/components/common/ScopeChips";
import { ListPagination } from "@/components/common/ListPagination";
import { HandoverTabs } from "./HandoverTabs";
import { HandoverControls } from "./HandoverControls";
import { HandoverHistoryControls } from "./HandoverHistoryControls";
import { HandoverProgressSearch } from "./HandoverProgressSearch";
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
import type { HandoverStatus } from "@/features/handover/schemas";
import type { HandoverProgressStatus } from "@/features/handover/progress-schemas";

const PAGE_SIZE = 30;

type SearchParams = {
  q?: string;
  status?: string;
  type?: string;
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
    const mineProgress = params.mine !== "false";
    const q = (params.q ?? "").trim().toLowerCase();
    const pageNum = Math.max(1, Number(params.page) || 1);
    const PROGRESS_PAGE_SIZE = 30;

    const allReady = await listReadyServices(
      mineProgress ? (me?.email ?? undefined) : undefined,
    );
    const typeFilter = (params.type ?? "").trim();

    const filtered = allReady.filter((s) => {
      if (
        q &&
        !s.university_name.toLowerCase().includes(q) &&
        !s.service_name.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (typeFilter && s.application_type !== typeFilter) return false;
      return true;
    });

    // 접수구분 select 옵션 — allReady(필터 전) distinct + 항상 노출할 표준 옵션('공통원서')
    const applicationTypes = Array.from(
      new Set([
        "공통원서",
        ...allReady.map((s) => s.application_type).filter(Boolean),
      ]),
    ).sort();

    const total = filtered.length;
    const paged = filtered.slice(
      (pageNum - 1) * PROGRESS_PAGE_SIZE,
      pageNum * PROGRESS_PAGE_SIZE,
    );

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
        <HandoverProgressSearch applicationTypes={applicationTypes} />
        <HandoverWizard
          services={paged}
          allServices={allReady}
          operators={operatorCandidates}
          from={{
            name: me?.displayName ?? me?.email ?? "",
            email: me?.email ?? "",
          }}
          step1HeaderRight={<ScopeChips total={total} mineLabel="내 서비스" />}
          step1Footer={
            <ListPagination total={total} pageSize={PROGRESS_PAGE_SIZE} />
          }
        />
      </div>
    );
  }

  if (tab === "history") {
    const fallback = resolvePageMeta(slug, meta);
    const mineHist = params.mine !== "false";
    const statusHist = params.status as HandoverProgressStatus | undefined;
    const pageHist = Math.max(1, Number(params.page) || 1);
    const { rows: progressRows, total: totalHist } = await listHandoverProgress(
      {
        q: params.q,
        status: statusHist,
        toEmail: mineHist ? me?.email : undefined,
        page: pageHist,
        pageSize: PAGE_SIZE,
      },
    );
    return (
      <div>
        <PageHeader
          pathname={pathname}
          meta={fallback.meta}
          headline={fallback.headline}
          description={fallback.description}
        />
        <HandoverTabs />
        <HandoverHistoryControls />
        <section className="p-7">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="flex items-baseline gap-2">
                <h2 className="text-xl font-bold text-ink">인계 이력</h2>
                <span className="text-muted" aria-hidden>
                  ·
                </span>
                <span className="text-sm text-vermilion">{totalHist}건</span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <ScopeChips total={totalHist} mineLabel="내 인계" />
              </div>
            </div>
          </header>
          <HandoverHistory rows={progressRows} meEmail={me?.email ?? null} />
          <div className="pt-4">
            <ListPagination total={totalHist} pageSize={PAGE_SIZE} />
          </div>
        </section>
      </div>
    );
  }

  const page = Math.max(1, Number(params.page) || 1);
  const statusParam = params.status as HandoverStatus | "none" | undefined;
  const mine = params.mine !== "false";
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

  return (
    <ListPattern
      title="서비스"
      data={{ rows }}
      header={header}
      controlsRow={controlsRow}
      variant="handover"
      canCreate={false}
      liveData
      currentUserName={me?.displayName ?? me?.email ?? ""}
      inlineFilters={
        <ScopeChips key="handover-scope" total={total} mineLabel="내 서비스" />
      }
      footer={
        <ListPagination
          key="handover-pagination"
          total={total}
          pageSize={PAGE_SIZE}
        />
      }
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
    universityType: r.university_type,
    handoverServiceNumber: r.service_number,
    handoverStatus: r.handover_status ?? undefined,
    handoverContractInfoMd: r.contract_info_md,
    handoverContractInfo: r.contract_info,
    handoverContractDataMd: r.contract_data_md,
    handoverContractChecklist: r.contract_data_checklist,
    handoverWorkBasicMd: r.work_basic_md,
    handoverWorkGeneratorMd: r.work_generator_md,
    handoverWorkSiteMd: r.work_site_md,
    handoverWorkOutputMd: r.work_output_md,
    handoverWorkRateMd: r.work_rate_md,
    handoverWorkFileMd: r.work_file_md,
    handoverWorkEtcMd: r.work_etc_md,
    handoverPaymentFeeMd: r.payment_fee_md,
    handoverPaymentInvoiceMd: r.payment_invoice_md,
    handoverPaymentFee: r.payment_fee,
    handoverPaymentInvoice: r.payment_invoice,
    handoverSchoolContactMd: r.school_contact_md,
    handoverSchoolContacts: r.school_contacts,
    handoverDocsMd: r.docs_md,
    handoverDocsChecklist: r.docs_checklist,
    handoverNotesMd: r.notes_md,
  };
}
