import type { ListRow, Filter } from "../../../patterns/ListPattern";

// services 1차 PR: 단순 filter set. ownerMe 본인 필터는 page.tsx searchParams에서
// listServices() 호출에 ownerMe + ownerEmail로 전달 (filter button 분기와 별개).
// 마감 임박 / 단독 등은 URL query로 page.tsx에서 처리.
export const SERVICES_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
];

export function blankServiceRow(): ListRow {
  return {
    id: "",
    name: "",
    status: "active",
    owner: "",
    serviceIdNum: 0,
    applicationType: "",
    region: "",
    universityName: "",
    serviceName: "",
    universityType: "",
    category: "",
    operatorEmail: null,
    operatorName: null,
    developerEmail: null,
    developerName: null,
    writeStartAt: null,
    writeEndAt: null,
    payStartAt: null,
    payEndAt: null,
    solo: false,
    source: "folio_create",
    importedAt: null,
  };
}
