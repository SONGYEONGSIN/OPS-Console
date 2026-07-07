import { inRange, type MetricValue, type Period } from "./types";

/** 사고보고 — 본인(assignee_email) 기간 내 처리완료율(%). 담당 0건이면 무사고=100. */
export function aggregateIncidents(
  rows: { assignee_email: string; status: string; created_at: string }[],
  email: string,
  p: Period,
): MetricValue {
  const mine = rows.filter(
    (r) => r.assignee_email === email && inRange(r.created_at, p),
  );
  if (mine.length === 0) return { value: 100, unit: "%", detail: "무사고" };
  const resolved = mine.filter((r) => r.status === "처리완료").length;
  const rate = Math.round((resolved / mine.length) * 1000) / 10;
  return { value: rate, unit: "%", detail: `${resolved}/${mine.length}` };
}
