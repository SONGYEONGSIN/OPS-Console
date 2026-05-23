import type { ConsoleLogEntry } from "@/app/dashboard/_components/live/mock-log-pool";

type WorklogRowLike = {
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  domain: string;
  msg: string;
};

/** worklog 행 → 콘솔 ConsoleLogEntry.
 *  text: `[{DOMAIN}] {msg}` (도메인 대문자, 예: '[INCIDENTS] 결제 오류 발생')
 *  type: INFO/DEBUG → 'info', WARN → 'warn', ERROR → 'err' */
export function worklogRowToConsoleLine(row: WorklogRowLike): ConsoleLogEntry {
  const type: ConsoleLogEntry["type"] =
    row.level === "ERROR" ? "err" : row.level === "WARN" ? "warn" : "info";
  return {
    text: `[${row.domain.toUpperCase()}] ${row.msg}`,
    type,
  };
}

/** worklog 배열(DESC, 최신 first) → 콘솔 라인 배열(오름차순, 자동 스크롤 친화). */
export function worklogRowsToConsoleLines(rows: WorklogRowLike[]): ConsoleLogEntry[] {
  return [...rows].reverse().map(worklogRowToConsoleLine);
}
