import type { ConsoleLogEntry } from "@/app/dashboard/_components/live/mock-log-pool";

type WorklogRowLike = {
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  domain: string;
  msg: string;
  /** 활동 주체 표시명 — 있으면 도메인 태그 뒤에 '{이름} · ' 형태로 노출. */
  user_name?: string | null;
};

/** worklog 행 → 콘솔 ConsoleLogEntry.
 *  text: `[{DOMAIN}] {user_name} · {msg}` (이름이 있을 때, 예: '[NAV] 김지나 · 페이지 진입')
 *        이름이 없으면 `[{DOMAIN}] {msg}` (시스템 이벤트 등)
 *  type: INFO/DEBUG → 'info', WARN → 'warn', ERROR → 'err' */
export function worklogRowToConsoleLine(row: WorklogRowLike): ConsoleLogEntry {
  const type: ConsoleLogEntry["type"] =
    row.level === "ERROR"
      ? "err"
      : row.level === "WARN"
        ? "warn"
        : row.level === "DEBUG"
          ? "debug"
          : "info";
  const who = row.user_name ? `${row.user_name} · ` : "";
  return {
    text: `[${row.domain.toUpperCase()}] ${who}${row.msg}`,
    type,
  };
}

/** worklog 배열(DESC, 최신 first) → 콘솔 라인 배열(오름차순, 자동 스크롤 친화). */
export function worklogRowsToConsoleLines(
  rows: WorklogRowLike[],
): ConsoleLogEntry[] {
  return [...rows].reverse().map(worklogRowToConsoleLine);
}
