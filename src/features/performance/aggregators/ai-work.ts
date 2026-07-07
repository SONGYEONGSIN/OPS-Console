import { inRange, type MetricValue, type Period } from "./types";

/** AI자동화(내작업) — 본인(author_email) 기간 내 AI 결과물 등록 수. */
export function aggregateAiWork(
  rows: { author_email: string; created_at: string }[],
  email: string,
  p: Period,
): MetricValue {
  const count = rows.filter(
    (r) => r.author_email === email && inRange(r.created_at, p),
  ).length;
  return { value: count, unit: "건" };
}
