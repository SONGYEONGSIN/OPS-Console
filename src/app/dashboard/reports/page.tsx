import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getReportKpis, listReports } from "@/features/reports/queries";
import {
  reportPeriodSchema,
  type ReportPeriod,
} from "@/features/reports/schemas";
import { PeriodSelector } from "./_components/PeriodSelector";
import { KpiGrid } from "./_components/KpiGrid";
import { ReportsList } from "./_components/ReportsList";

function pickPeriod(raw: string | undefined): ReportPeriod {
  const r = reportPeriodSchema.safeParse(raw);
  return r.success ? r.data : "this-month";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const slug = "reports";
  await requireMenu(slug);
  const meta = findSidebarMeta(slug);
  if (!meta) return null;

  const sp = await searchParams;
  const period = pickPeriod(sp.period);
  const [snap, savedReports] = await Promise.all([
    getReportKpis(period),
    listReports(),
  ]);

  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta);

  return (
    <div className="flex flex-col">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
      <section className="flex h-full min-h-0 flex-col p-5 md:p-6 lg:p-7">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">{meta.label}</h2>
            <p className="mt-1 text-xs text-muted">
              {snap.periodRange.startYmd} ~ {snap.periodRange.endYmd}
            </p>
          </div>
          <PeriodSelector />
        </header>

        <KpiGrid kpis={snap.kpis} className="mb-8" />

        <ReportsList reports={savedReports} />
      </section>
    </div>
  );
}
