import { inRange, type MetricValue, type Period } from "./types";

/** 서비스마감 — 본인(operator_name) 기간 내 마감 완수(write_end_at 존재) 건수.
 *  operatorName이 null(operators 미매칭)이면 0 — silent fallback 없이 미매칭 반영. */
export function aggregateClosing(
  rows: { operator_name: string | null; write_end_at: string | null }[],
  operatorName: string | null,
  p: Period,
): MetricValue {
  if (!operatorName) return { value: 0, unit: "건", detail: "미매칭" };
  const count = rows.filter(
    (r) => r.operator_name === operatorName && inRange(r.write_end_at, p),
  ).length;
  return { value: count, unit: "건" };
}
