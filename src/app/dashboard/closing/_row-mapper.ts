import type { ListRow } from "../_components/patterns/ListPattern";
import type { ClosingRow } from "@/features/closing/schemas";

/**
 * closing_services(DB) → ListRow. services variant를 재사용하므로 services 필드명에 매핑.
 * 읽기 전용(편집/생성 없음)이라 operatorEmail/payStartAt 등 편집 전용 필드는 생략.
 */
export function closingRowToListRow(r: ClosingRow): ListRow {
  return {
    id: r.id,
    name: r.service_name,
    status: "active",
    owner: r.operator_name ?? "",
    serviceIdNum: r.service_id,
    region: r.region ?? "",
    universityName: r.university_name,
    serviceName: r.service_name,
    universityType: r.university_type ?? "",
    category: r.category ?? "",
    operatorName: r.operator_name ?? null,
    developerName: r.developer_name ?? null,
    writeStartAt: r.write_start_at ?? null,
    writeEndAt: r.write_end_at,
    solo: r.solo,
    scrapedAt: r.scraped_at,
  };
}
