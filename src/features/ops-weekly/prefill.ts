// 새 보고서의 프로젝트 entry 를 지난주 값으로 미리 채운다 — 순수 함수.
import type { ProjectStage } from "./constants";

export type PrefillEntry = {
  stage: ProjectStage | null;
  this_week: string;
  next_week: string;
};

/** 단계는 그대로, 금주 ← 지난주 차주, 차주는 빈칸. */
export function prefillEntry(
  prev: { stage: ProjectStage | null; next_week: string } | null,
): PrefillEntry {
  if (prev === null) return { stage: null, this_week: "", next_week: "" };
  return { stage: prev.stage, this_week: prev.next_week, next_week: "" };
}
