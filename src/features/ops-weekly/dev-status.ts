/**
 * 개발 구분 리더 계약 — A4(Moa 스크랩)가 `ops_weekly_dev_status` 를 채우고 여기서 읽는다.
 * 그 주에 수집되지 않은 구분은 **미확인**이다. 지난주 값을 이번 주 사실처럼 쓰지 않는다.
 */
import { weekWindows } from "./week";

export const DEV_STAGES = ["dev", "test"] as const;
export type DevStage = (typeof DEV_STAGES)[number];

export type DevStatusRow = {
  service_id: number;
  stage: DevStage;
  collected_at: string;
};

export function freshDevStages(
  rows: readonly DevStatusRow[],
  weekStart: string,
): Map<number, DevStage> {
  const startMs = weekWindows(weekStart).startInstant.getTime();
  const out = new Map<number, DevStage>();
  for (const r of rows) {
    if (Date.parse(r.collected_at) >= startMs) out.set(r.service_id, r.stage);
  }
  return out;
}
