import type { ListRow } from "../../../patterns/ListPattern";

/** 사고 보고 상태 필터 — 우측 "현재상황 전체" select와 중복이라 chip 미노출. ScopeChips(전체/내 사고)만 유지. */
export const INCIDENT_FILTERS = [] as const;

/** 자주 쓰는 카테고리 suggestion (datalist) */
export const INCIDENT_CATEGORY_SUGGESTIONS = [
  "결제",
  "원서작성",
  "사이트",
  "경쟁률",
  "기타",
] as const;

/**
 * '+ 새 사고 보고' 클릭 시 신규 행 factory. EditForm 첫 진입 시 default 값 채움.
 * 학년도 default는 page.tsx에서 currentAcademicYear()로 주입.
 */
export function blankIncidentRow(opts?: {
  currentUserName?: string;
  currentAcademicYear?: number;
  currentUserTeam?: "운영1팀" | "운영2팀";
}): ListRow {
  const dept =
    opts?.currentUserTeam === "운영2팀"
      ? "운영부-운영2팀"
      : "운영부-운영1팀";
  return {
    id: "",
    name: "",
    status: "active",
    owner: opts?.currentUserName ?? "",
    incidentYear: opts?.currentAcademicYear ?? new Date().getFullYear(),
    incidentUniversityName: "",
    incidentAppType: "공통원서",
    incidentCategory: "",
    incidentOccurredDate: null,
    incidentResolvedDate: null,
    incidentTitle: "",
    incidentCauseSummary: null,
    incidentRootCause: null,
    incidentResolution: null,
    incidentPrevention: null,
    incidentDepartment: dept,
    incidentAssigneeName: opts?.currentUserName ?? "",
    incidentStatus: "미처리",
  };
}
