import type { ListRow } from "../_components/patterns/ListPattern";
import type { IncidentRow } from "@/features/incidents/schemas";

export function incidentToListRow(r: IncidentRow): ListRow {
  return {
    id: r.id,
    name: r.title,
    status: "active",
    owner: r.assignee_name ?? "—",
    incidentYear: r.year,
    incidentUniversityName: r.university_name ?? undefined,
    incidentAppType: r.app_type,
    incidentCategory: r.category,
    incidentOccurredDate: r.occurred_date ?? null,
    incidentResolvedDate: r.resolved_date ?? null,
    incidentTitle: r.title,
    incidentCauseSummary: r.cause_summary ?? null,
    incidentRootCause: r.root_cause ?? null,
    incidentResolution: r.resolution ?? null,
    incidentPrevention: r.prevention ?? null,
    incidentDepartment: r.department,
    incidentAssigneeEmail: r.assignee_email ?? undefined,
    incidentAssigneeName: r.assignee_name ?? undefined,
    incidentReporterEmail: r.reporter_email,
    incidentReporterName: r.reporter_name,
    incidentStatus: r.status,
  };
}
