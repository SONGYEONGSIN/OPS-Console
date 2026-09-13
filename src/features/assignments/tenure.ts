import { z } from "zod";

/**
 * 연차 그룹 — **저장값**. 순서는 입사일로 재현되지만 경계는 사람 판단이라 저장한다
 * (3그룹이 2019~2022로 폭이 넓다). 설계: `2026-09-12-work-assignment-design.md` §5.2
 *
 * 값이 `'1-1' < '1-2' < '2' < … < '6'` 인 이유는 **문자열 정렬이 곧 연차 순서**여야
 * 배분현황이 그룹을 연차 순으로 늘어놓을 수 있기 때문이다(한 자리 숫자라 성립).
 */
export const TENURE_GROUPS = ["1-1", "1-2", "2", "3", "4", "5", "6"] as const;

export type TenureGroup = (typeof TENURE_GROUPS)[number];

/** 화면 라벨. Record 로 두면 그룹이 늘 때 라벨 누락이 타입 에러가 된다. */
export const TENURE_GROUP_LABELS: Record<TenureGroup, string> = {
  "1-1": "1그룹1",
  "1-2": "1그룹2",
  "2": "2그룹",
  "3": "3그룹",
  "4": "4그룹",
  "5": "5그룹",
  "6": "6그룹",
};

/**
 * DB 에는 check 제약을 걸지 않았다 — 그룹이 하나 늘 때 마이그레이션을 잊으면 조직
 * 화면 저장이 500 으로 죽는다. 그래서 **여기가 유일한 관문**이다.
 */
export const tenureGroupSchema = z.enum(TENURE_GROUPS);

/**
 * 배정 근거가 되는 경력 시작일 — `career_start_at` 이 비어 있으면 `hired_at` 을 쓴다.
 *
 * `hired_at` 은 인사 사실이라 건드리지 않는다. 재입사자는 `hired_at` 이 최근이어서
 * 그대로 연차를 세면 신입으로 읽힌다. 정의를 한 곳에 두는 이유는 두 벌이 되면 한쪽만
 * 재입사를 반영해 같은 사람이 화면마다 다른 연차로 보이기 때문이다.
 */
export function careerStartOf(operator: {
  career_start_at?: string | null;
  hired_at: string;
}): string {
  return operator.career_start_at ?? operator.hired_at;
}
