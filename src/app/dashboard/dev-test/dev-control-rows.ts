import type { ListRow } from "../_components/patterns/ListPattern";
import type { DevControlAnalysis } from "@/features/dev-controls/schemas";
import type { TestableService } from "@/features/entertest/queries";

/** analyses 중 가장 최근 analyzed_at (ISO). 빈 배열이면 null. */
function latestAnalyzedAt(analyses: DevControlAnalysis[]): string | null {
  if (analyses.length === 0) return null;
  return analyses.reduce((a, b) => (a.analyzed_at >= b.analyzed_at ? a : b))
    .analyzed_at;
}

/**
 * 개발 탭 목록 행 조립 (순수함수) — 서비스 기준 그룹핑.
 *
 * - 모든 testable 서비스를 1행씩 생성, service_id로 devControlAnalyses를 그룹핑해 첨부.
 * - 분석 없는 서비스도 빈 배열로 포함해 "미수집" 표시가 가능하도록 한다 (Table 책임).
 * - flags는 가공 없이 원본 그대로 전달 — 미확인 건수 계산은 Table/View 책임.
 * - 정렬: 최근 analyzed_at 내림차순. 분석 없는 서비스(=null)는 뒤로.
 */
export function buildDevControlRows(
  services: TestableService[],
  analyses: DevControlAnalysis[],
): ListRow[] {
  const analysesByService = new Map<number, DevControlAnalysis[]>();
  for (const analysis of analyses) {
    const arr = analysesByService.get(analysis.service_id) ?? [];
    arr.push(analysis);
    analysesByService.set(analysis.service_id, arr);
  }

  const rows: ListRow[] = services.map((s) => ({
    id: String(s.service_id),
    name: s.service_name,
    status: "active",
    owner: s.operator_name ?? "",
    serviceIdNum: s.service_id,
    universityName: s.university_name,
    serviceName: s.service_name,
    operatorName: s.operator_name ?? "",
    devControlAnalyses: analysesByService.get(s.service_id) ?? [],
  }));

  return [...rows].sort((a, b) => {
    const aLatest = latestAnalyzedAt(a.devControlAnalyses ?? []);
    const bLatest = latestAnalyzedAt(b.devControlAnalyses ?? []);
    if (aLatest === null && bLatest === null) return 0;
    if (aLatest === null) return 1;
    if (bLatest === null) return -1;
    return aLatest > bLatest ? -1 : aLatest < bLatest ? 1 : 0;
  });
}
