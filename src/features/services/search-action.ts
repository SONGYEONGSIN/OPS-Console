"use server";

import { listServices } from "./queries";

export type ServiceSearchHit = {
  id: string;
  universityName: string;
  serviceName: string;
  operatorName: string | null;
};

/**
 * 상단 검색창 — 대학명·서비스명·운영자 매칭 서비스 (light, 최대 8건).
 * listServices의 search(q)는 university_name / service_name / operator_name ilike.
 */
export async function searchServices(
  query: string,
): Promise<ServiceSearchHit[]> {
  const term = query.trim();
  if (term.length < 1) return [];
  const { rows } = await listServices({
    search: term,
    sort: "service_id_asc",
    pageSize: 8,
  });
  return rows.map((r) => ({
    id: r.id,
    universityName: r.university_name,
    serviceName: r.service_name,
    operatorName: r.operator_name,
  }));
}
