import type { ListRow } from "../../../patterns/ListPattern";

/** 경위서 결재 상태 chip 미노출 — 우측 select/배지로 상태 표시. ScopeChips(전체/내 경위서)만 유지. */
export const INCIDENT_REPORT_FILTERS = [] as const;

/**
 * '+ 경위서 작성' 클릭 시 신규 행 factory. EditForm 첫 진입 시 default 값 채움.
 * 작성자는 page.tsx에서 currentUserName으로 주입.
 */
export function blankIncidentReportRow(opts?: {
  currentUserName?: string;
}): ListRow {
  return {
    id: "",
    name: "",
    status: "active",
    owner: opts?.currentUserName ?? "",
    incidentReportStatus: "draft",
    incidentReportUniversity: "",
    incidentReportTitle: "",
    incidentReportGyeongwi: null,
    incidentReportCause: null,
    incidentReportHandling: null,
    incidentReportPrevention: null,
    incidentReportApology: null,
    incidentReportAuthorName: opts?.currentUserName ?? "",
    incidentReportApproverName: null,
    incidentReportDirectorName: null,
    incidentReportCeoName: null,
    incidentReportRejectReason: null,
    incidentReportIncidentId: null,
  };
}
