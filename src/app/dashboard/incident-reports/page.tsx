import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  listIncidentReports,
  listRecipientCandidates,
} from "@/features/incident-reports/queries";
import {
  createIncidentReport,
  updateIncidentReport,
} from "@/features/incident-reports/actions";
import { incidentReportToListRow } from "./_row-mapper";

export default async function IncidentReportsPage() {
  const slug = "incident-reports";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const me = await getCurrentOperator();
  const canEdit = me?.permission === "admin" || me?.permission === "member";

  const dbRows = await listIncidentReports();

  // 승인 완료 경위서는 발송 수신자 후보를 대학별로 조회해 인스펙터 picker에 첨부.
  const rows: ListRow[] = await Promise.all(
    dbRows.map(async (r) => {
      const row = incidentReportToListRow(r);
      row.incidentReportIsApprover =
        !!me?.email && r.approver_email === me.email;
      row.incidentReportCanSend =
        me?.permission === "admin" ||
        (!!me?.email && r.author_email === me.email);
      if (r.status === "approved" && row.incidentReportCanSend) {
        const candidates = await listRecipientCandidates(r.recipient_university);
        row.incidentReportRecipients = candidates.map((c) => ({
          email: c.contact_email as string,
          name: c.customer_name as string,
          jobTitle: (c.job_title as string | null) ?? null,
        }));
      }
      return row;
    }),
  );

  const config = resolvePageMeta(slug, meta, dbRows.length);

  const header = (
    <div key="incident-reports-header">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
    </div>
  );

  async function onPersist(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const payload = {
      recipient_university: row.incidentReportUniversity ?? "",
      title: row.incidentReportTitle ?? row.name ?? "",
      gyeongwi: row.incidentReportGyeongwi ?? null,
      cause: row.incidentReportCause ?? null,
      handling: row.incidentReportHandling ?? null,
      prevention: row.incidentReportPrevention ?? null,
      apology: row.incidentReportApology ?? null,
    };
    if (isNew) {
      const r = await createIncidentReport(payload);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    const r = await updateIncidentReport(row.id, payload);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="incident-reports"
      canCreate={canEdit}
      createLabel="+ 경위서 작성"
      readOnly={!canEdit}
      currentUserPermission={me?.permission ?? null}
      currentUserEmail={me?.email ?? null}
      currentUserName={me?.displayName ?? me?.email ?? ""}
      onPersist={canEdit ? onPersist : undefined}
    />
  );
}
