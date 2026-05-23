import type { ConsoleLogEntry } from "./mock-log-pool";

export type ToastEvent = { text: string; type: "info" | "warn" | "err" };

type WorklogRow = { level: string; domain: string; msg: string };
type IncidentRow = { title: string; owner_email?: string | null };
type TodoRow = { title: string; owner_email?: string | null };
type BackupRequestRow = { summary_md: string; requester_email: string };
type DataRequestSendRow = {
  university_name: string;
  status: string;
  created_by_email: string;
};

/** worklog 행 → 콘솔 라인 변환. */
export function formatWorklogConsoleLine(row: WorklogRow): ConsoleLogEntry {
  const type: ConsoleLogEntry["type"] =
    row.level === "ERROR" ? "err" : row.level === "WARN" ? "warn" : row.level === "DEBUG" ? "debug" : "info";
  return { text: `[${row.domain.toUpperCase()}] ${row.msg}`, type };
}

/** incidents INSERT → 토스트 이벤트 (항상 warn). */
export function formatIncidentToast(row: IncidentRow): ToastEvent {
  return { text: `[사고] ${row.title}`, type: "warn" };
}

/** todos INSERT → 토스트 이벤트 (항상 info). */
export function formatTodoToast(row: TodoRow): ToastEvent {
  return { text: `[할일] ${row.title}`, type: "info" };
}

/** backup_requests INSERT → 토스트 이벤트 (summary_md 30자 slice). */
export function formatBackupRequestToast(row: BackupRequestRow): ToastEvent {
  const preview = row.summary_md.slice(0, 30);
  return { text: `[백업] ${preview}`, type: "info" };
}

type HandoverRecordRow = { author_name: string; author_email: string; service_id: string };

/** handover_records INSERT → 토스트 이벤트 (항상 info). */
export function formatHandoverToast(row: HandoverRecordRow): ToastEvent {
  return { text: `[인수인계] ${row.author_name} 등록`, type: "info" };
}

/** data_request_sends UPDATE → 토스트 이벤트 (sent/failed 만, 나머지는 null). */
export function formatDataRequestSendToast(
  row: DataRequestSendRow,
): ToastEvent | null {
  if (row.status === "sent") {
    return { text: `[자료요청] ${row.university_name} 발송`, type: "info" };
  }
  if (row.status === "failed") {
    return {
      text: `[자료요청] ${row.university_name} 발송 실패`,
      type: "err",
    };
  }
  return null;
}
