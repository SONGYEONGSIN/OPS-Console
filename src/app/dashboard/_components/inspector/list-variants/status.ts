import type { ListRow } from "../../patterns/ListPattern";

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
  urgent: "bg-vermilion text-cream",
  approved: "bg-line-soft text-muted",
  review: "bg-gold/20 text-gold",
  active: "bg-sage/20 text-sage",
  inactive: "bg-gold/20 text-gold",
  suspended: "bg-vermilion/20 text-vermilion",
  deleted: "bg-ink/20 text-ink-soft",
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
