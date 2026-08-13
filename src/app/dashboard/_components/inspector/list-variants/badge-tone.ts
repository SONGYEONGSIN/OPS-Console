/**
 * 상태 배지 색 공통 규칙 — 색을 상태 enum이 아니라 **라벨의 의미**에 묶는다.
 *
 * 같은 enum이 화면마다 다른 뜻이라(피드백의 approved="처리완료" vs 서비스의 approved="정상")
 * enum 기준으로는 공통 규칙을 만들 수 없다. 설계: docs/superpowers/specs/2026-08-11-status-badge-tone-design.md
 */
export const BADGE_TONE = {
  /** 봐야 할 것 — 긴급 + 이상 종료(실패·반려·중단·정지) */
  attention: "bg-vermilion-deep text-cream",
  /** 진행 중인 작업 */
  progress: "bg-vermilion text-cream",
  /** 정상 종료 */
  done: "bg-ink text-cream",
  /** 대기·구분 — 그 외 전부 */
  idle: "bg-line-soft text-muted",
} as const;

/** '중'으로 끝나지 않지만 진행 단계인 라벨. */
const PROGRESS_EXTRA = new Set(["확인", "진행"]);

/** '완료'가 들어가지만 종료가 아닌 라벨 — 예약완료는 아직 발송 전이다. */
const DONE_EXCLUDED = new Set(["예약완료"]);

/**
 * '완료/종료' 문구가 없지만 정상 종료인 라벨.
 *
 * '성공'·'생성'은 자동화 실행 로그의 라벨이다. 여기 없으면 대기(그레이)로 떨어져
 * 바로 옆 '실패'(진한 빨강) 옆에서 성공이 눈에 안 띈다 — 로그를 훑는 목적 자체가 무너진다.
 *
 * '발송'은 일부러 넣지 않았다. 견적서에서는 '고객에게 보냄(응답 대기)'이라 종료가 아니다.
 * 자동화 로그의 메일 발송은 라벨을 '발송완료'로 적어 뜻을 분명히 한다.
 */
const DONE_EXTRA = new Set(["수주", "수금", "성공", "생성"]);

const ATTENTION = new Set([
  "긴급",
  "장애",
  "오류",
  "미수",
  "반려",
  "중단",
  "정지",
]);

/**
 * 상태 라벨 → 배지 톤 클래스. 위에서부터 먼저 맞는 규칙을 적용한다.
 * 모르는 라벨은 대기(그레이)로 떨어진다 — 새 상태가 생겨도 화면이 깨지지 않는다.
 */
export function statusBadgeTone(label: string): string {
  const s = label.trim();

  if (ATTENTION.has(s) || s.includes("실패")) return BADGE_TONE.attention;
  if (s.endsWith("중") || PROGRESS_EXTRA.has(s)) return BADGE_TONE.progress;
  if (DONE_EXCLUDED.has(s)) return BADGE_TONE.idle;
  if (s.includes("완료") || s.includes("종료") || DONE_EXTRA.has(s))
    return BADGE_TONE.done;
  return BADGE_TONE.idle;
}
