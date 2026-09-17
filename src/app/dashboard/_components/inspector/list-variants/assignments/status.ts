import { BADGE_TONE } from "../badge-tone";
import type { AssignmentBadge } from "@/features/assignments/badges";

/**
 * 배정 배지 → 상태 배지 Tailwind 톤 클래스.
 *
 * 판정은 `features/assignments/badges.ts` 가 한다(PR6 게이트와 공유). 여기는 색만
 * 붙인다 — `features/` 에 Tailwind 클래스가 들어가면 안 된다.
 *
 * 키 누락은 `Record<AssignmentBadge, …>` 가 타입에서 막고 `status.test.ts` 가
 * 런타임에서도 본다. 색이 규칙(BADGE_TONE 4개) 안에 있는지는 타입이 못 보므로
 * `__tests__/badge-tone.test.ts` 가 보는데, **그 가드는 import 가 하드코딩이라
 * 새 톤맵을 손으로 등록해야 걸린다.**
 */
export const ASSIGNMENT_BADGE_TONE: Record<AssignmentBadge, string> = {
  // 사람이 고쳐야 하는 유일한 상태 — 시트 이름이 운영자 명단에 없다.
  "연결 안 됨": BADGE_TONE.attention,
  // 설계 F2 가 정상으로 인정한 상태다.
  미배정: BADGE_TONE.idle,
  // 사람이 이유가 있어 갈라놓은 것이다(실데이터 44곳).
  분할: BADGE_TONE.idle,
};
