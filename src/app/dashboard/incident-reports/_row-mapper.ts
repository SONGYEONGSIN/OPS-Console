import type { ListRow } from "../_components/patterns/ListPattern";
import type { IncidentReportRow } from "@/features/incident-reports/schemas";

export function incidentReportToListRow(r: IncidentReportRow): ListRow {
  return {
    id: r.id,
    name: r.title,
    status: "active",
    owner: r.author_name,
    incidentReportStatus: r.status,
    incidentReportUniversity: r.recipient_university,
    incidentReportTitle: r.title,
    incidentReportDraftDate: r.draft_date,
    incidentReportGyeongwi: r.gyeongwi,
    incidentReportCause: r.cause,
    incidentReportHandling: r.handling,
    incidentReportPrevention: r.prevention,
    incidentReportApology: r.apology,
    incidentReportAuthorName: r.author_name,
    incidentReportAuthorEmail: r.author_email,
    incidentReportApproverName: r.approver_name,
    incidentReportApproverEmail: r.approver_email,
    incidentReportDirectorName: r.director_name,
    incidentReportCeoName: r.ceo_name,
    incidentReportRejectReason: r.reject_reason,
    incidentReportIncidentId: r.incident_id,
    incidentReportDocNumber: r.doc_number,
  };
}
