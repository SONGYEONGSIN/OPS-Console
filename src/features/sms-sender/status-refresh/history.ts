import "server-only";
import { OPERATORS } from "@/features/auth/operators";
import type { CurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  failureCopy,
  refreshResultSchema,
  type RefreshHistoryItem,
  type RequestStatus,
  stepLabel,
  type StatusRefreshView,
} from "./contract";
import { STATUS_REFRESH_AUTOMATION_REQUESTER } from "./enqueue";
import { canRequestStatusRefresh } from "./permission";

const TABLE = "sms_status_refresh_requests";
const HISTORY_LIMIT = 5;
const LOAD_ERROR = "최신화 이력을 읽지 못했습니다.";

export type RequestRow = {
  id: string;
  requested_at: string;
  requested_by: string;
  status: RequestStatus;
  finished_at: string | null;
  message: string | null;
  result: unknown;
};

/** 요청자 메일 → 화면 이름. 메일 원문은 화면에 내보내지 않는다. */
export function requesterName(requestedBy: string): string {
  if (requestedBy === STATUS_REFRESH_AUTOMATION_REQUESTER) return "자동화";
  const key = requestedBy.trim().toLowerCase();
  const op = OPERATORS.find((o) => o.email.toLowerCase() === key);
  return op?.name ?? "알 수 없음";
}

/**
 * 큐 한 행 → 이력 한 줄. 실패한 단계는 코드 대신 사람이 할 일로 적는다.
 * `message` 는 폴러 tail 이 섞일 수 있어 화면에 쓰지 않는다.
 */
export function toHistoryItem(
  row: RequestRow,
  nameOf: (requestedBy: string) => string,
): RefreshHistoryItem {
  const base = {
    id: row.id,
    requestedAt: row.requested_at,
    finishedAt: row.finished_at,
    requester: nameOf(row.requested_by),
    status: row.status,
  };
  if (row.result === null || row.result === undefined) {
    const crashed = row.status === "failed";
    return {
      ...base,
      steps: [],
      changes: [],
      note: crashed ? failureCopy("poller_crashed") : null,
    };
  }
  const parsed = refreshResultSchema.safeParse(row.result);
  if (!parsed.success) {
    return { ...base, steps: [], changes: [], note: failureCopy("unknown") };
  }
  return {
    ...base,
    steps: parsed.data.steps.map((s) => ({
      label: stepLabel(s.step),
      status: s.status,
      summary: s.summary,
      action:
        s.status === "ok" ? null : failureCopy(s.error?.code ?? "unknown"),
    })),
    changes: parsed.data.changes,
    note: null,
  };
}

/** 내부관리자 화면 — 버튼 권한 + 최근 5건 이력. requireMenu 를 통과한 서버만 부른다. */
export async function getStatusRefreshView(
  me: CurrentOperator,
): Promise<StatusRefreshView> {
  const canRequest = canRequestStatusRefresh(
    me,
    process.env.SMS_SENDER_REQUEST_MANAGER_EMAIL,
  );
  const { data, error } = await createAdminClient()
    .from(TABLE)
    .select(
      "id, requested_at, requested_by, status, finished_at, message, result",
    )
    .order("requested_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) {
    return { canRequest, active: null, history: [], loadError: LOAD_ERROR };
  }

  const rows = (data ?? []) as RequestRow[];
  const activeRow = rows.find(
    (r) => r.status === "pending" || r.status === "running",
  );
  return {
    canRequest,
    active: activeRow
      ? {
          status: activeRow.status as "pending" | "running",
          requestedAt: activeRow.requested_at,
        }
      : null,
    history: rows.map((r) => toHistoryItem(r, requesterName)),
    loadError: null,
  };
}
