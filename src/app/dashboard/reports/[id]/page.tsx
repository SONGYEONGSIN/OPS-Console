import Link from "next/link";
import { notFound } from "next/navigation";
import { findSidebarMeta } from "../../_data";
import { resolvePageMeta } from "../../_data/page-meta-derive";
import { PageHeader } from "../../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getReportById } from "@/features/reports/queries";
import { ReportDetail } from "./_components/ReportDetail";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireMenu("reports");
  const meta = findSidebarMeta("reports");
  if (!meta) return null;
  const { id } = await params;
  const report = await getReportById(id);
  if (!report) notFound();

  const pathname = `/dashboard/reports/${id}`;
  const config = resolvePageMeta("reports", meta);

  return (
    <div className="flex flex-col">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <section className="flex h-full min-h-0 flex-col p-5 md:p-6 lg:p-7">
        <header className="mb-4 flex items-center gap-3">
          <Link
            href="/dashboard/reports"
            className="text-vermilion hover:underline"
          >
            ← 분석보고서 목록
          </Link>
        </header>
        <ReportDetail report={report} />
      </section>
    </div>
  );
}
