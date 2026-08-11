import type { ListRow } from "../../patterns/ListPattern";
import { BADGE_TONE } from "./badge-tone";

/**
 * ListPattern variant 테이블 + InspectorPanel header 공통 상태 표기.
 * variant별로 미묘하게 라벨이 다른 경우(예: team View의 "urgent: 장애" vs
 * 테이블의 "urgent: 긴급")는 각 variant 모듈이 자체 STATUS_LABEL을 inline.
 */
export const STATUS_LABEL: Record<ListRow["status"], string> = {
  urgent: "긴급",
  approved: "정상",
  review: "점검중",
  active: "활성",
  inactive: "점검중",
  suspended: "정지",
  deleted: "삭제",
};

export const STATUS_COLOR: Record<ListRow["status"], string> = {
  urgent: BADGE_TONE.attention,
  approved: BADGE_TONE.idle,
  review: BADGE_TONE.progress,
  active: BADGE_TONE.idle,
  inactive: BADGE_TONE.progress,
  suspended: BADGE_TONE.attention,
  deleted: BADGE_TONE.idle,
};

export const STATUS_RING: Record<ListRow["status"], string> = {
  urgent: "bg-vermilion",
  approved: "bg-muted",
  review: "bg-gold",
  active: "bg-sage",
  inactive: "bg-gold",
  suspended: "bg-vermilion",
  deleted: "bg-muted",
};
