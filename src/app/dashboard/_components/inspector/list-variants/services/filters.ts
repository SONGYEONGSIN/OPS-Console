import type { ListRow, Filter } from "../../../patterns/ListPattern";

// services variant의 status 기반 filter chip은 사용 안 함.
// "전체 / 내 서비스" mutual exclusive 토글은 ServicesScopeChips(URL 기반) 컴포넌트가
// ListPattern의 `inlineFilters` prop으로 주입되어 filter chip 영역을 단독 책임.
export const SERVICES_FILTERS: { value: Filter; label: string }[] = [];

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
