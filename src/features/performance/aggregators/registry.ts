/**
 * 정량 지표 aggregator 레지스트리 — 1 소스 = 1 엔트리.
 * source_key(performance_metrics.source_key) → 메타 + 데이터 소스 식별.
 * 2차 확장 = 여기 1줄 + aggregator 모듈 1개.
 */
export const AGGREGATOR_REGISTRY = {
  "closing-completed": {
    label: "서비스 마감 완수",
    unit: "건",
    source: "closing_services",
    description: "담당 서비스의 기간 내 마감 완수 건수",
  },
  "incident-resolve-rate": {
    label: "사고 처리완료율",
    unit: "%",
    source: "incidents",
    description: "담당 사고 처리완료율 (담당 0건이면 무사고 100%)",
  },
  "ai-work-count": {
    label: "AI 결과물",
    unit: "건",
    source: "ai_work",
    description: "기간 내 AI 자동화 결과물 등록 수",
  },
} as const;

export type AggregatorKey = keyof typeof AGGREGATOR_REGISTRY;
export const AGGREGATOR_KEYS = Object.keys(
  AGGREGATOR_REGISTRY,
) as AggregatorKey[];
