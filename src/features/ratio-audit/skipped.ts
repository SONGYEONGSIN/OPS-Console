import type { RatioSkipped } from "./schemas";

/**
 * 점검에서 빠진 건의 단계와 묶음 (순수 함수).
 *
 * 수집이 못 간 것과 판정이 못 한 것은 다른 사고다. 2026-09-04 세팅 점검은 116건 중
 * 66건이 판정 실패였는데 "이상 없음 · 성공"으로 적혔다. 서버(집계·실행 로그)와
 * 화면이 같은 판정을 써야 두 곳이 어긋나지 않아 여기 한 곳에 둔다.
 */

export type SkippedStage = "collect" | "judge";

/** audit.py 가 판정 실패에 붙이는 사유 접두 — stage 필드가 생기기 전 payload 의 단서. */
const JUDGE_REASON_PREFIX = "판정 실패";

/** 줄에 적는 serviceId 수 — 66건을 다 적으면 사유보다 번호가 길어진다. */
export const SKIPPED_IDS_SHOWN = 5;

/**
 * stage 가 있으면 그대로, 없으면(DB 에 남은 옛 payload·구버전 스크립트)
 * 사유가 '판정 실패'로 시작할 때 판정 단계로 본다.
 */
export function skippedStage(s: RatioSkipped): SkippedStage {
  if (s.stage) return s.stage;
  return s.reason.startsWith(JUDGE_REASON_PREFIX) ? "judge" : "collect";
}

export type SkippedGroup = {
  stage: SkippedStage;
  reason: string;
  serviceIds: number[];
};

/** 같은 단계·같은 사유를 한 묶음으로. 처음 나온 순서를 지킨다. */
export function groupSkipped(skipped: RatioSkipped[]): SkippedGroup[] {
  return skipped.reduce<SkippedGroup[]>((groups, s) => {
    const stage = skippedStage(s);
    const same = (g: SkippedGroup) =>
      g.stage === stage && g.reason === s.reason;
    return groups.some(same)
      ? groups.map((g) =>
          same(g) ? { ...g, serviceIds: [...g.serviceIds, s.serviceId] } : g,
        )
      : [...groups, { stage, reason: s.reason, serviceIds: [s.serviceId] }];
  }, []);
}

const STAGE_LABEL: Record<SkippedStage, string> = {
  collect: "건너뜀",
  judge: "판정 못 함",
};

/** `판정 못 함 66건 — <사유> (id, id … 외 N건)` 한 줄. */
export function skippedGroupText(group: SkippedGroup): string {
  const shown = group.serviceIds.slice(0, SKIPPED_IDS_SHOWN);
  const rest = group.serviceIds.length - shown.length;
  const ids = shown.join(", ") + (rest > 0 ? ` 외 ${rest}건` : "");
  return (
    `${STAGE_LABEL[group.stage]} ${group.serviceIds.length}건 — ` +
    `${group.reason} (${ids})`
  );
}
