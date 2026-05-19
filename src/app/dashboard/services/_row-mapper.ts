import type { ServicesRow } from "@/features/services/schemas";
import type { ListRow } from "../_components/patterns/ListPattern";

/**
 * services 도메인 row → 공통 ListRow 변환.
 * services 페이지와 schedule(calendar) 둘 다 동일 inspector view를 쓰기 위해 공유.
 */
export function servicesRowToListRow(r: ServicesRow): ListRow {
  return {
    id: r.id,
    name: r.service_name,
    status: "active",
    owner: r.operator_name ?? r.operator_email ?? "-",
    serviceIdNum: r.service_id,
    applicationType: r.application_type,
    region: r.region,
    universityName: r.university_name,
    serviceName: r.service_name,
    universityType: r.university_type,
    category: r.category,
    operatorEmail: r.operator_email,
    operatorName: r.operator_name,
    developerEmail: r.developer_email,
    developerName: r.developer_name,
    writeStartAt: r.write_start_at,
    writeEndAt: r.write_end_at,
    payStartAt: r.pay_start_at,
    payEndAt: r.pay_end_at,
    solo: r.solo,
    source: r.source,
    importedAt: r.imported_at,
  };
}
