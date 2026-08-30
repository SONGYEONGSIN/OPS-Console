/**
 * 정량 지표 aggregator 레지스트리 — 1 소스 = 1 엔트리.
 * source_key(performance_metrics.source_key) → 메타 + 데이터 소스 식별.
 * 2차 확장 = 여기 1줄 + aggregator 모듈 1개.
 *
 * kind: "rate" — 값이 0~100 백분율(달성률로 직결) / "count" — 건수(달성률 아님, 목표 대비 관리자 판단)
 */
export const AGGREGATOR_REGISTRY = {
  "closing-completed": {
    label: "서비스 마감 완수",
    unit: "건",
    kind: "count",
    source: "closing_services",
    description: "담당 서비스의 기간 내 마감 완수 건수",
  },
  "incident-resolve-rate": {
    label: "사고 처리완료율",
    unit: "%",
    kind: "rate",
    source: "incidents",
    description: "담당 사고 처리완료율 (담당 0건이면 무사고 100%)",
  },
  "ai-work-count": {
    label: "AI 결과물",
    unit: "건",
    kind: "count",
    source: "ai_work",
    description: "기간 내 AI 자동화 결과물 등록 수",
  },
  "ai-work-hours": {
    label: "AI 절감시간",
    unit: "시간",
    kind: "count",
    source: "ai_work",
    description:
      "기간 내 AI 결과물의 절감시간 합. 건수보다 '몇 시간을 아꼈나'가 성과에 가깝다",
  },
  "announcement-services": {
    label: "합격자발표 서비스",
    unit: "건",
    kind: "count",
    source: "announcement_services",
    description:
      "기간 내 본인 담당 발표 건수. 담당은 총괄장에서 이름으로 맞춰 채운다 — 못 맞춘 대학은 '미매칭'으로 드러난다",
  },
  "entertest-runs": {
    label: "원서 테스트 실행",
    unit: "건",
    kind: "count",
    source: "entertest_test_runs",
    description:
      "기간 내 본인이 돌린 원서 테스트. 실패도 센다 — 깨진 걸 찾는 일이라 실패를 빼면 일을 많이 한 사람이 적게 한 것으로 보인다",
  },
  "dev-control-changes": {
    label: "원서접수 세팅 변경",
    unit: "건",
    kind: "count",
    source: "dev_control_setting_changes",
    description:
      "기간 내 본인 담당 서비스의 GEN 세팅(WA/WB/PA/PB…) 변경 관측. 수집이 수동 실행이라 실행 사이의 여러 수정은 한 건으로 뭉친다 — '횟수'가 아니라 '관측'이다",
  },
} as const;

export type AggregatorKey = keyof typeof AGGREGATOR_REGISTRY;
export const AGGREGATOR_KEYS = Object.keys(
  AGGREGATOR_REGISTRY,
) as AggregatorKey[];
