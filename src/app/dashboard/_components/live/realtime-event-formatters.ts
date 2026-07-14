import type { ConsoleLogEntry } from "./mock-log-pool";

export type ToastEvent = { text: string; type: "info" | "warn" | "err" };

type WorklogRow = {
  level: string;
  domain: string;
  msg: string;
  user_name?: string | null;
  user_email?: string | null;
};

/**
 * Realtime payload 검증 공통 — 만료된 JWT(RLS 미인가)로 구독 중이면
 * 이벤트가 빈 레코드({})로 도착한다. 각 parse*는 필수 필드가 없으면
 * null을 반환해 포매터/토스트 진입 전에 걸러낸다.
 */
function asRecord(input: unknown): Record<string, unknown> | null {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)
    : null;
}

function optStr(r: Record<string, unknown>, key: string): string | null {
  return typeof r[key] === "string" ? (r[key] as string) : null;
}

export function parseWorklogRow(input: unknown): WorklogRow | null {
  const r = asRecord(input);
  if (
    !r ||
    typeof r.level !== "string" ||
    typeof r.domain !== "string" ||
    typeof r.msg !== "string"
  ) {
    return null;
  }
  return {
    level: r.level,
    domain: r.domain,
    msg: r.msg,
    user_name: optStr(r, "user_name"),
    user_email: optStr(r, "user_email"),
  };
}

export function parseIncidentRow(input: unknown): IncidentRow | null {
  const r = asRecord(input);
  if (!r || typeof r.title !== "string") return null;
  return { title: r.title, owner_email: optStr(r, "owner_email") };
}

export function parseTodoRow(input: unknown): TodoRow | null {
  const r = asRecord(input);
  if (!r || typeof r.title !== "string") return null;
  return { title: r.title, owner_email: optStr(r, "owner_email") };
}

export function parseBackupRequestRow(
  input: unknown,
): BackupRequestRow | null {
  const r = asRecord(input);
  if (
    !r ||
    typeof r.summary_md !== "string" ||
    typeof r.requester_email !== "string"
  ) {
    return null;
  }
  return { summary_md: r.summary_md, requester_email: r.requester_email };
}

export function parseDataRequestSendRow(
  input: unknown,
): DataRequestSendRow | null {
  const r = asRecord(input);
  if (
    !r ||
    typeof r.university_name !== "string" ||
    typeof r.status !== "string" ||
    typeof r.created_by_email !== "string"
  ) {
    return null;
  }
  return {
    university_name: r.university_name,
    status: r.status,
    created_by_email: r.created_by_email,
  };
}
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
    row.level === "ERROR"
      ? "err"
      : row.level === "WARN"
        ? "warn"
        : row.level === "DEBUG"
          ? "debug"
          : "info";
  const who = row.user_name ? `${row.user_name} · ` : "";
  return { text: `[${row.domain.toUpperCase()}] ${who}${row.msg}`, type };
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

type HandoverRecordRow = {
  author_name: string;
  author_email: string;
  service_id: string;
};

export function parseHandoverRecordRow(
  input: unknown,
): HandoverRecordRow | null {
  const r = asRecord(input);
  if (
    !r ||
    typeof r.author_name !== "string" ||
    typeof r.author_email !== "string" ||
    typeof r.service_id !== "string"
  ) {
    return null;
  }
  return {
    author_name: r.author_name,
    author_email: r.author_email,
    service_id: r.service_id,
  };
}

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
