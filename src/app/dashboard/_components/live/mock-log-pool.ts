export type ConsoleLogType = "info" | "warn" | "err";
export type ConsoleLogEntry = { text: string; type: ConsoleLogType };

/** 초기 부팅 시 콘솔에 표시될 3줄. */
export const INITIAL_CONSOLE_LINES: ConsoleLogEntry[] = [
  { text: "[SYS] 모니터링 콘솔 접속 성공.", type: "info" },
  { text: "[SYS] Supabase 실시간 소켓 연결 확인.", type: "info" },
  { text: "[CRON] insights-collect 스케줄러 대기 중.", type: "info" },
];

/** 시뮬레이션 ON 시 무작위로 추가될 로그 풀. */
export const LOG_POOL: ConsoleLogEntry[] = [
  { text: "[CRON] insights-collect 작업 실행 완료 (max: collected_at 확인)", type: "info" },
  { text: "[WARN] youtube-api quota 소모 감지: 1회 누적 (650 unit 소모)", type: "warn" },
  { text: "[DB] user_sessions 인덱스 풀 검사 완료 (정상)", type: "info" },
  { text: "[CRON] automation_settings 읽기 성공. insights-collect 자동 실행 ON 확인", type: "info" },
  { text: "[ERR] auth_gateway Azure AD SSO 검사 오류 - 토큰 만료 재시도 진행 중", type: "err" },
  { text: "[SYS] backup-requests 데몬이 신규 요청 큐 검색 중...", type: "info" },
  { text: "[DB] automation_settings 테이블 RLS select 정책 검증 완료", type: "info" },
];

/** 토스트 메시지 풀 (이모지 없음 — vermilion LED dot이 시각 신호). */
export const TOAST_MESSAGE_POOL: string[] = [
  "[사고] Redis 세션 장애 복구 요청 수신",
  "[사고] API 할당량 80% 초과 발생",
  "[할일] 대학 연락망 동기화 건 배정",
  "[서비스] 중앙대 신규 서브 도메인 배포 대기",
  "[백업] 마이그레이션 전 백업 스케줄 등록",
];

/** 풀에서 무작위 한 건 추출. */
export function pickRandom<T>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}