import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type NoticeKind =
  | "request"
  | "remind"
  | "all-submitted"
  | "returned"
  | "reported";

export type NoticeRow = {
  week_id: string;
  kind: NoticeKind;
  slot: string;
  recipient: string;
  status: "sent" | "dry_run" | "failed";
  error: string | null;
};

/** 그 슬롯에 이미 보낸(또는 시험 실행한) 받는 사람 — failed 는 다시 보내야 해서 넣지 않는다. */
export async function deliveredRecipients(
  weekId: string,
  slot: string,
): Promise<Set<string>> {
  const res = await createAdminClient()
    .from("ops_weekly_notices")
    .select("recipient")
    .eq("week_id", weekId)
    .eq("slot", slot)
    .in("status", ["sent", "dry_run"]);
  if (res.error) {
    throw new Error(`[ops-weekly] ops_weekly_notices: ${res.error.message}`);
  }
  return new Set(
    ((res.data ?? []) as { recipient: string }[]).map((r) => r.recipient),
  );
}

/** 같은 (주, 슬롯, 받는 사람) 은 덮어쓴다 — failed 가 다음 호출에서 sent 로 바뀐다. */
export async function recordNotices(rows: readonly NoticeRow[]): Promise<void> {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  const res = await createAdminClient()
    .from("ops_weekly_notices")
    .upsert(
      rows.map((r) => ({ ...r, updated_at: now })),
      { onConflict: "week_id,slot,recipient" },
    );
  if (res.error) {
    throw new Error(`[ops-weekly] ops_weekly_notices: ${res.error.message}`);
  }
}
