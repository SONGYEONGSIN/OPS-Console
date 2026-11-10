import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "manual_review_reminders";
const ERROR_MAX = 500;

/** 관리자 요약의 수신자 키 머리 — 반기마다 관리자 한 명에 한 번. */
export const SUMMARY_KEY_PREFIX = "__summary__:";

export function summaryKey(adminEmail: string): string {
  return `${SUMMARY_KEY_PREFIX}${adminEmail.trim().toLowerCase()}`;
}

export type ReminderStatus = "sent" | "failed" | "dry_run";

export type ReminderRecord = {
  half_key: string;
  recipient_key: string;
  status: ReminderStatus;
  manual_count: number;
  message_id: string | null;
  /** 오류 코드만(`mailErrorCode`) — 응답 본문에는 주소가 섞일 수 있다. */
  error: string | null;
};

// supabase-js 는 오류를 던지지 않는다 — 확인해서 던진다.
function assertOk(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

/** 그 반기에 이미 보낸(sent) 수신자 키. dry_run·failed 는 다시 보낼 대상이다. */
export async function loadSentKeys(
  db: SupabaseClient,
  halfKey: string,
): Promise<Set<string>> {
  const { data, error } = await db
    .from(TABLE)
    .select("recipient_key")
    .eq("half_key", halfKey)
    .eq("status", "sent");
  assertOk(error, "매뉴얼 점검 알림 기록 조회 실패");
  return new Set(
    ((data ?? []) as { recipient_key: string }[]).map((r) => r.recipient_key),
  );
}

/** 보낸 직후 한 건씩 남긴다 — 도중에 멈춰도 앞서 보낸 사람이 다음 호출에서 다시 받지 않게. */
export async function saveReminder(
  db: SupabaseClient,
  rec: ReminderRecord,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db.from(TABLE).upsert(
    {
      ...rec,
      error: rec.error ? rec.error.slice(0, ERROR_MAX) : null,
      sent_at: rec.status === "sent" ? now : null,
      updated_at: now,
    },
    { onConflict: "half_key,recipient_key" },
  );
  assertOk(error, "매뉴얼 점검 알림 기록 실패");
}
