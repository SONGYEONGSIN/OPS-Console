import type { AutoArea } from "@/features/ops-weekly/constants";
import type { AutoSnapshot } from "@/features/ops-weekly/merge";

/** 묶음 제목 단일 소스 — 왼쪽 묶음 머리와 쓸 것 패널의 묶음 선택이 같은 문구를 쓴다. */
export const APP_GROUP_TITLE = {
  dev: "개발 중",
  test: "테스트 중",
  unknown: "구분 미확인",
  running: "운영 중",
  opening: "차주 오픈 예정",
  closing: "차주 마감 예정",
  other: "원서접수 외 서비스",
} as const;

export const PIMS_GROUP_TITLE = {
  thisWeek: "금주 발표",
  nextWeek: "차주 발표",
} as const;

export const LEAVE_GROUP_TITLE = "휴가·외근 일정";

export type DirectAddGroup = { key: string | null; label: string };

const APP_ADD_KEYS = ["dev", "test", "running", "opening", "closing", "other"] as const;
const APP_ADD_KEYS_UNCOLLECTED = ["running", "opening", "closing", "other"] as const;

/**
 * 직접 추가를 받는 묶음 — 구분 미확인은 늘 뺀다(자동으로만 차는 묶음).
 * 구분이 수집되기 전 주는 개발·테스트도 뺀다(그 칸은 '아직 수집되지 않았습니다' 한 줄이다).
 */
export function directAddGroups(
  area: AutoArea,
  devStatusCollected: boolean,
): DirectAddGroup[] {
  if (area === "application") {
    const keys = devStatusCollected ? APP_ADD_KEYS : APP_ADD_KEYS_UNCOLLECTED;
    return keys.map((key) => ({ key, label: APP_GROUP_TITLE[key] }));
  }
  if (area === "pims") {
    return (["thisWeek", "nextWeek"] as const).map((key) => ({
      key,
      label: PIMS_GROUP_TITLE[key],
    }));
  }
  return [{ key: null, label: LEAVE_GROUP_TITLE }];
}

/** 원서접수 하위 탭 판정 입력 — KPI 카드와 쓸 것 패널의 묶음 기본값이 같은 식을 쓴다. */
export function appSubStateOf(
  app: AutoSnapshot["application"] | null | undefined,
): { showUnknown: boolean; collected: boolean } {
  const collected = app?.devStatusCollected ?? true;
  return { showUnknown: collected && (app?.unknown.length ?? 0) > 0, collected };
}
