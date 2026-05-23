export type ConsoleLogType = "info" | "warn" | "err" | "debug";
export type ConsoleLogEntry = { text: string; type: ConsoleLogType };

/** 초기 부팅 시 콘솔에 표시될 3줄. */
export const INITIAL_CONSOLE_LINES: ConsoleLogEntry[] = [
  { text: "[SYS] 모니터링 콘솔 접속 성공.", type: "info" },
  { text: "[SYS] Supabase 실시간 소켓 연결 확인.", type: "info" },
  { text: "[CRON] insights-collect 스케줄러 대기 중.", type: "info" },
];
