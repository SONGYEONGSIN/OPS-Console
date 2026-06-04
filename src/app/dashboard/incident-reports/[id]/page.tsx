import Link from "next/link";
import { notFound } from "next/navigation";
import { findSidebarMeta } from "../../_data";
import { resolvePageMeta } from "../../_data/page-meta-derive";
import { PageHeader } from "../../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  getIncidentReport,
  resolveApprovalChain,
} from "@/features/incident-reports/queries";
import { getIncidentById } from "@/features/incidents/queries";
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

  // 담당자 = 연결된 사고(사고보고)의 작성 담당자. 결재 체인도 그 담당자 기준으로 해석.
  const incident = report.incident_id
    ? await getIncidentById(report.incident_id).catch(() => null)
    : null;
  const dutyName = incident?.assignee_name ?? report.author_name;
  const chainEmail = incident?.assignee_email ?? report.author_email;

  // 결재라인 — 저장 스냅샷에 빠진 칸은 현재 조직 기준으로 라이브 보강(비파괴).
  const liveChain = await resolveApprovalChain(chainEmail).catch(() => null);
  const approval = {
    approverName: report.approver_name ?? liveChain?.approver?.name ?? null,
    approverRole: report.approver_role ?? liveChain?.approver?.role ?? null,
    directorName: report.director_name ?? liveChain?.director?.name ?? null,
    directorRole: report.director_role ?? liveChain?.director?.role ?? null,
    ceoName: report.ceo_name ?? liveChain?.ceo?.name ?? null,
    ceoRole: report.ceo_role ?? liveChain?.ceo?.role ?? null,
  };

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
          report={{
            ...report,
            // 연결된 사고의 현재 대학명(수신처)으로 동기화(스냅샷 staleness 방지)
            recipient_university:
              incident?.university_name ?? report.recipient_university,
          }}
          canManageApproval={canManageApproval}
          previewDocNumber={previewDocNumber}
          approval={approval}
          dutyName={dutyName}
          dutyEmail={chainEmail}
          dutyPhone={liveChain?.author?.phone ?? null}
        />
      </section>
    </div>
  );
}
