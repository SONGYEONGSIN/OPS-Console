import Link from "next/link";
import { notFound } from "next/navigation";
import { findSidebarMeta } from "../../_data";
import { resolvePageMeta } from "../../_data/page-meta-derive";
import { PageHeader } from "../../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { getIncidentReport } from "@/features/incident-reports/queries";
import { previewNextDocNumber } from "@/features/incident-reports/sharepoint-register";
import type { IncidentReportRow } from "@/features/incident-reports/schemas";
import { ReportEditorWorkspace } from "./_components/ReportEditorWorkspace";

export default async function IncidentReportEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireMenu("incidents");
  const meta = findSidebarMeta("incidents");
  if (!meta) return null;
  const { id } = await params;
  const report = (await getIncidentReport(id)) as IncidentReportRow | null;
  if (!report) notFound();

  const me = await getCurrentOperator();
  const canManageApproval =
    me?.permission === "admin" || me?.email === report.approver_email;

  // 발송 전이면 공문관리대장에서 예상 시행번호를 미리보기로 조회(확정 아님, 발송 시 채번).
  const previewDocNumber =
    report.doc_number ??
    (await previewNextDocNumber(new Date()).catch(() => null));

  const config = resolvePageMeta("incidents", meta);

  return (
    <div className="flex flex-col">
      <PageHeader
        pathname="/dashboard/incidents"
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <section className="flex h-full min-h-0 flex-col p-5 md:p-6 lg:p-7">
        <header className="mb-4 flex items-center gap-3">
          <Link
            href="/dashboard/incidents"
            className="text-vermilion hover:underline"
          >
            ← 사고 보고 목록
          </Link>
        </header>
        <ReportEditorWorkspace
          report={report}
          canManageApproval={canManageApproval}
          previewDocNumber={previewDocNumber}
        />
      </section>
    </div>
  );
}
