import { BADGE_TONE } from "@/app/dashboard/_components/inspector/list-variants/badge-tone";

/** 등록된 번호 — _발신번호 시트 '상태' 열의 값. */
const REGISTERED = new Set(["일괄 등록", "추가 등록", "등록완료"]);
/** 봐야 할 것 — 서류가 모자라 아직 등록이 안 됐다. */
const ATTENTION = new Set(["서류 미비"]);

/**
 * 발신번호 상태 → 배지 톤. 공통 `statusBadgeTone` 을 안 쓰는 이유: '일괄 등록'·
 * '추가 등록' 에는 '완료' 가 없어 대기(그레이)로 떨어지고, '서류 미비' 도 공통
 * 규칙에 없다. 공통 규칙은 여러 화면이 쓰므로 여기서만 따로 묶는다.
 * 모르는 값은 대기 — 새 상태가 생겨도 '등록됨' 으로 잘못 칠하지 않는다.
 */
export function numberStatusTone(status: string): string {
  const s = status.trim();
  if (REGISTERED.has(s)) return BADGE_TONE.done;
  if (ATTENTION.has(s)) return BADGE_TONE.attention;
  return BADGE_TONE.idle;
}
