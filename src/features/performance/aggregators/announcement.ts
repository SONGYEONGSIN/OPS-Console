import { inRange, type MetricValue, type Period } from "./types";

/**
 * 합격자발표 서비스 — 본인 담당(operator_name) 기간 내 발표 건수.
 *
 * 이 표는 운영자 컬럼이 없어 개인 귀속이 **원천적으로 불가능**했다. 총괄장에서
 * 이름으로 맞춰 `operator_name` 을 채운 뒤에야 셀 수 있다.
 *
 * 총괄장은 이름(한글)으로 배정하므로 여기도 이름으로 맞춘다 — 다른 갈래는
 * 이메일이지만 이 갈래만 이름이다(closing_services 와 같은 사정).
 */
export function aggregateAnnouncement(
  rows: { operator_name: string | null; last_announce_at: string | null }[],
  operatorName: string | null,
  p: Period,
): MetricValue {
  // 이름을 못 찾으면 0 이 아니라 '미매칭' 이다 — 0 은 '한 건도 안 했다'로 읽힌다.
  if (!operatorName) return { value: 0, unit: "건", detail: "미매칭" };
  const count = rows.filter(
    (r) => r.operator_name === operatorName && inRange(r.last_announce_at, p),
  ).length;
  return { value: count, unit: "건" };
}
