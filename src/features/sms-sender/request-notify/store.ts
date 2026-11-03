import type { SupabaseClient } from "@supabase/supabase-js";
import { STALE_SENDING_MINUTES, type NoticeKind, type NoticeRow, type Recovery } from "./types";

const TABLE = "sms_sender_request_notices";
const ERROR_MAX = 500;

const COLUMNS =
  "item_id,last_status,new_state,new_attempts,new_claimed_at,done_state,done_attempts,done_claimed_at";

// supabase-js 는 오류를 던지지 않는다 — 확인해서 던진다.
function assertOk(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export async function loadNoticeRows(db: SupabaseClient): Promise<NoticeRow[]> {
  const { data, error } = await db.from(TABLE).select(COLUMNS);
  assertOk(error, "알림 기록 조회 실패");
  return (data ?? []) as NoticeRow[];
}

export async function insertNoticeRows(
  db: SupabaseClient,
  rows: NoticeRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await db
    .from(TABLE)
    .upsert(rows, { onConflict: "item_id", ignoreDuplicates: true });
  assertOk(error, "알림 기록 추가 실패");
}

export async function updateLastStatus(
  db: SupabaseClient,
  updates: { item_id: string; last_status: string }[],
  now: Date,
): Promise<void> {
  for (const u of updates) {
    const { error } = await db
      .from(TABLE)
      .update({
        last_status: u.last_status,
        updated_at: now.toISOString(),
      })
      .eq("item_id", u.item_id);
    assertOk(error, "마지막 상태 갱신 실패");
  }
}

// 여전히 sending 이고 잡은 지 STALE 분이 지난 칸만 되돌린다 — 겹친 다른 실행이
// 방금 새로 잡은 칸(claimed_at 이 최근)을 낡은 판정으로 덮어쓰지 않도록.
export async function applyRecoveries(
  db: SupabaseClient,
  recoveries: Recovery[],
  now: Date,
): Promise<void> {
  const cutoff = new Date(now.getTime() - STALE_SENDING_MINUTES * 60_000).toISOString();
  for (const r of recoveries) {
    const { error } = await db
      .from(TABLE)
      .update({ [`${r.kind}_state`]: r.state, updated_at: now.toISOString() })
      .eq("item_id", r.item_id)
      .eq(`${r.kind}_state`, "sending")
      .lt(`${r.kind}_claimed_at`, cutoff);
    assertOk(error, "잡힌 칸 회수 실패");
  }
}

// 조건부 UPDATE 로 칸을 잡는다. 갱신된 행이 1이면 내가 잡은 것이다.
export async function claimNotice(
  db: SupabaseClient,
  itemId: string,
  kind: NoticeKind,
  attempts: number,
  now: Date,
): Promise<boolean> {
  const { data, error } = await db
    .from(TABLE)
    .update({
      [`${kind}_state`]: "sending",
      [`${kind}_attempts`]: attempts + 1,
      [`${kind}_claimed_at`]: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("item_id", itemId)
    .eq(`${kind}_state`, "pending")
    .eq(`${kind}_attempts`, attempts)
    .select("item_id");
  assertOk(error, "알림 칸 잡기 실패");
  return (data ?? []).length === 1;
}

export async function finishNotice(
  db: SupabaseClient,
  itemId: string,
  kind: NoticeKind,
  result: {
    state: "sent" | "dry_run" | "pending" | "failed";
    messageId?: string;
    error?: string;
    now: Date;
  },
): Promise<boolean> {
  const sentLike = result.state === "sent" || result.state === "dry_run";
  const payload: Record<string, unknown> = {
    [`${kind}_state`]: result.state,
    updated_at: result.now.toISOString(),
  };
  if (sentLike) {
    payload[`${kind}_sent_at`] = result.now.toISOString();
    payload[`${kind}_message_id`] = result.messageId ?? null;
    payload[`${kind}_error`] = null;
  }
  if (result.error !== undefined) {
    payload[`${kind}_error`] = result.error.slice(0, ERROR_MAX);
  }
  const { data, error } = await db
    .from(TABLE)
    .update(payload)
    .eq("item_id", itemId)
    .eq(`${kind}_state`, "sending")
    .select("item_id");
  assertOk(error, "알림 결과 기록 실패");
  return (data ?? []).length === 1;
}
