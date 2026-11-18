/**
 * 개발 구분 리더 계약 — A4(Moa 스크랩)가 `ops_weekly_dev_status` 를 채우고 여기서 읽는다.
 * 그 주에 수집되지 않은 구분은 **미확인**이다. 지난주 값을 이번 주 사실처럼 쓰지 않는다.
 */
import { weekWindows } from "./week";

// deployed = 리얼배포가 끝났는데 접수가 아직 시작 전. 개발·테스트 어느 묶음에도 넣지 않는다.
export const DEV_STAGES = ["dev", "test", "deployed"] as const;
export type DevStage = (typeof DEV_STAGES)[number];

export type DevStatusRow = {
  service_id: number;
  stage: DevStage;
  collected_at: string;
};

/**
 * Moa 작업진행현황의 두 칸으로 가른다. 리얼배포 일시가 있으면 테스트 오픈과 무관하게 deployed,
 * 아니면 테스트 오픈이 '-' 면 아직 개발, 검증된 일시가 있으면 테스트 단계다.
 */
export function stageFromMoa(row: {
  test_open: string;
  real_deploy: string;
}): DevStage {
  if (row.real_deploy !== "-") return "deployed";
  return row.test_open === "-" ? "dev" : "test";
}

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
