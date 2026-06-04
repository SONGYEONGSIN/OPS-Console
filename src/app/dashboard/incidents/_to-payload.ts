import type { ListRow } from "../_components/patterns/ListPattern";

/**
 * 사고 ListRow(camelCase) → createIncident/updateIncident payload(snake_case).
 * 순수 함수 — 저장 누락 회귀(특히 service_name)를 테스트로 가드한다.
 */
export function toIncidentPayload(row: ListRow, fallbackYear: number) {
  return {
    year: row.incidentYear ?? fallbackYear,
    university_name: row.incidentUniversityName ?? "",
    service_name: row.incidentServiceName ?? null,
    app_type: row.incidentAppType ?? "공통원서",
    category: row.incidentCategory ?? "",
    occurred_date: row.incidentOccurredDate ?? null,
    resolved_date: row.incidentResolvedDate ?? null,
    title: row.incidentTitle ?? row.name ?? "",
    cause_summary: row.incidentCauseSummary ?? null,
    root_cause: row.incidentRootCause ?? null,
    resolution: row.incidentResolution ?? null,
    prevention: row.incidentPrevention ?? null,
    department: row.incidentDepartment ?? "운영부-운영1팀",
    status: row.incidentStatus ?? "미처리",
  };
}
