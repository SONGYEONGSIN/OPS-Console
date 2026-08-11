import { BADGE_TONE } from "../badge-tone";

/** 회의록 작성 상태 → 상태 배지 Tailwind 톤 클래스 */
export const MEETING_STATUS_TONE: Record<string, string> = {
  draft: BADGE_TONE.progress,
  sent: BADGE_TONE.done,
};
