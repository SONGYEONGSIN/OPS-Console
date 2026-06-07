import type { ListRow } from "../_components/patterns/ListPattern";
import type { ClosingRow } from "@/features/closing/schemas";

/**
 * closing_services(DB) → ListRow. services variant를 재사용하므로 services 필드명에 매핑.
 * 읽기 전용(편집/생성 없음)이라 operatorEmail 등 FK 편집 필드는 생략.
 * 결제기간(payStartAt/payEndAt)은 14컬럼 적재분 매핑. 접수구분(admission_type)은
 * ListRow에 대응 필드가 없어 DB에만 저장(services Table/View 미표시).
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
    payStartAt: r.pay_start_at ?? null,
    payEndAt: r.pay_end_at ?? null,
    solo: r.solo,
    scrapedAt: r.scraped_at,
  };
}
