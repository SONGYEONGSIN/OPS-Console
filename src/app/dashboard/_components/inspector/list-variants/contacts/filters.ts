import type { Filter, ListRow } from "../../../patterns/ListPattern";

// contacts 1차 PR: 단순 filter set (button 분기 없음).
// 검색·등급 등 모든 필터는 page.tsx searchParams로 SSR 처리.
// ScopeChips 미주입 (담당자 컬럼 없음 — "내 연락처" 의미 불명)
export const CONTACTS_FILTERS: { value: Filter; label: string }[] = [];

export function blankContactRow(): ListRow {
  return {
    id: "",
    name: "",
    status: "active",
    owner: "",
    customerActive: "재직",
    universityName: "",
    jobTitle: null,
    departmentName: null,
    jobRole: null,
    managementGrade: null,
    relationshipGrade: null,
    contactPhone: null,
    contactExt: null,
    contactEmail: null,
  };
}
