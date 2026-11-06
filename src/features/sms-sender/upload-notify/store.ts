import type { SupabaseClient } from "@supabase/supabase-js";
import { STALE_SENDING_MINUTES } from "../request-notify/types";
import type {
  HashFill,
  HashUpdate,
  Rearm,
  UploadInsert,
  UploadRecovery,
  UploadRow,
} from "./types";

const TABLE = "sms_sender_doc_upload_notices";
const ERROR_MAX = 500;
/** Supabase 기본 select 한도 — 이만큼 차면 다음 쪽이 있을 수 있다. */
const PAGE = 1000;
const INSERT_CHUNK = 500;

const COLUMNS =
  "item_id,name,folder_path,web_url,content_hash,change_kind,state,attempts,claimed_at";

// supabase-js 는 오류를 던지지 않는다 — 확인해서 던진다.
function assertOk(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

// 1,000행을 넘으면 넘친 파일이 '새 파일'로 보이므로 끝까지 쪽을 나눠 읽는다.
export async function loadUploadRows(db: SupabaseClient): Promise<UploadRow[]> {
  const rows: UploadRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(TABLE)
      .select(COLUMNS)
      .order("item_id")
      .range(from, from + PAGE - 1);
    assertOk(error, "업로드 알림 기록 조회 실패");
    const page = (data ?? []) as UploadRow[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

export async function insertUploadRows(
  db: SupabaseClient,
  rows: UploadInsert[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const { error } = await db
      .from(TABLE)
      .upsert(rows.slice(i, i + INSERT_CHUNK), {
        onConflict: "item_id",
        ignoreDuplicates: true,
      });
    assertOk(error, "업로드 알림 기록 추가 실패");
  }
}

// 이전 해시가 그대로이고 지금 보내는 중이 아닐 때만 다시 무장한다 —
// 겹친 실행이 이미 바꾼 행이나 발송 중인 행을 덮어쓰지 않도록.
export async function rearmUploads(
  db: SupabaseClient,
  rearms: Rearm[],
  now: Date,
): Promise<void> {
  for (const r of rearms) {
    const { error } = await db
      .from(TABLE)
      .update({
        name: r.name,
        folder_path: r.folder_path,
        web_url: r.web_url,
        content_hash: r.content_hash,
        change_kind: r.change_kind,
        state: r.state,
        attempts: 0,
        error: null,
        claimed_at: null,
        updated_at: now.toISOString(),
      })
      .eq("item_id", r.item_id)
      .eq("content_hash", r.prevHash)
      .neq("state", "sending");
    assertOk(error, "교체 알림 무장 실패");
  }
}

export async function fillHashes(
  db: SupabaseClient,
  fills: HashFill[],
  now: Date,
): Promise<void> {
  for (const f of fills) {
    const { error } = await db
      .from(TABLE)
      .update({ content_hash: f.content_hash, updated_at: now.toISOString() })
      .eq("item_id", f.item_id)
      .is("content_hash", null);
    assertOk(error, "해시 채우기 실패");
  }
}

// PDF 가 아닌 파일은 브라우저에서 고칠 때마다 해시가 바뀐다 — 알림 없이 해시만 따라간다.
export async function updateHashes(
  db: SupabaseClient,
  updates: HashUpdate[],
  now: Date,
): Promise<void> {
  for (const u of updates) {
    const { error } = await db
      .from(TABLE)
      .update({ content_hash: u.content_hash, updated_at: now.toISOString() })
      .eq("item_id", u.item_id)
      .eq("content_hash", u.prevHash);
    assertOk(error, "해시 갱신 실패");
  }
}

// 여전히 sending 이고 잡은 지 STALE 분이 지난 행만 되돌린다.
export async function recoverUploads(
  db: SupabaseClient,
  recoveries: UploadRecovery[],
  now: Date,
): Promise<void> {
  const cutoff = new Date(
    now.getTime() - STALE_SENDING_MINUTES * 60_000,
  ).toISOString();
  for (const r of recoveries) {
    const { error } = await db
      .from(TABLE)
      .update({ state: r.state, updated_at: now.toISOString() })
      .eq("item_id", r.item_id)
      .eq("state", "sending")
      .lt("claimed_at", cutoff);
    assertOk(error, "잡힌 업로드 알림 회수 실패");
  }
}

// 조건부 UPDATE 로 행을 잡는다. 갱신된 행이 1이면 내가 잡은 것이다.
export async function claimUpload(
  db: SupabaseClient,
  itemId: string,
  attempts: number,
  now: Date,
): Promise<boolean> {
  const { data, error } = await db
    .from(TABLE)
    .update({
      state: "sending",
      attempts: attempts + 1,
      claimed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("item_id", itemId)
    .eq("state", "pending")
    .eq("attempts", attempts)
    .select("item_id");
  assertOk(error, "업로드 알림 잡기 실패");
  return (data ?? []).length === 1;
}

/** 아직 sending 인 행만 결과를 적고, 실제로 갱신된 id 를 돌려준다. */
export async function finishUploads(
  db: SupabaseClient,
  itemIds: string[],
  result: {
    state: "sent" | "dry_run" | "pending" | "failed";
    messageId?: string;
    error?: string;
    now: Date;
  },
): Promise<string[]> {
  if (itemIds.length === 0) return [];
  const sentLike = result.state === "sent" || result.state === "dry_run";
  const payload: Record<string, unknown> = {
    state: result.state,
    updated_at: result.now.toISOString(),
    ...(sentLike
      ? {
          sent_at: result.now.toISOString(),
          message_id: result.messageId ?? null,
          error: null,
        }
      : {}),
    ...(result.error !== undefined
      ? { error: result.error.slice(0, ERROR_MAX) }
      : {}),
  };
  const { data, error } = await db
    .from(TABLE)
    .update(payload)
    .in("item_id", itemIds)
    .eq("state", "sending")
    .select("item_id");
  assertOk(error, "업로드 알림 결과 기록 실패");
  return ((data ?? []) as { item_id: string }[]).map((r) => r.item_id);
}
