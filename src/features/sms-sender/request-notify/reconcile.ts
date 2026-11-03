import {
  MAX_ATTEMPTS,
  STALE_SENDING_MINUTES,
  STATUS_DONE,
  type DueNotice,
  type NoticeKind,
  type NoticeRow,
  type NoticeState,
  type Recovery,
  type RequestItem,
} from "./types";

export type ReconcileResult = {
  inserts: NoticeRow[];
  statusUpdates: { item_id: string; last_status: string }[];
  recoveries: Recovery[];
  due: DueNotice[];
};

/** 첫 실행: 지금 있는 행에 메일을 쏟지 않도록 new 는 seeded, 아직 안 끝난 행의 done 만 남긴다. */
export function seedRows(items: RequestItem[]): NoticeRow[] {
  return items.map((item) => ({
    item_id: item.id,
    last_status: item.status,
    new_state: "seeded",
    new_attempts: 0,
    new_claimed_at: null,
    done_state: item.status === STATUS_DONE ? "seeded" : "pending",
    done_attempts: 0,
    done_claimed_at: null,
  }));
}

type Slot = { state: NoticeState; attempts: number; claimedAt: string | null };

function slotOf(row: NoticeRow, kind: NoticeKind): Slot {
  return kind === "new"
    ? { state: row.new_state, attempts: row.new_attempts, claimedAt: row.new_claimed_at }
    : { state: row.done_state, attempts: row.done_attempts, claimedAt: row.done_claimed_at };
}

function isStale(slot: Slot, now: Date): boolean {
  if (slot.state !== "sending" || slot.claimedAt === null) return false;
  const cutoff = now.getTime() - STALE_SENDING_MINUTES * 60_000;
  return new Date(slot.claimedAt).getTime() < cutoff;
}

const KINDS: readonly NoticeKind[] = ["new", "done"];

export function reconcile(
  items: RequestItem[],
  rows: NoticeRow[],
  now: Date,
): ReconcileResult {
  const byId = new Map(rows.map((r) => [r.item_id, r]));
  const inserts: NoticeRow[] = [];
  const statusUpdates: ReconcileResult["statusUpdates"] = [];
  const recoveries: Recovery[] = [];
  const due: DueNotice[] = [];

  for (const item of items) {
    const row = byId.get(item.id);
    if (!row) {
      inserts.push({
        item_id: item.id,
        last_status: item.status,
        new_state: "pending",
        new_attempts: 0,
        new_claimed_at: null,
        done_state: "pending",
        done_attempts: 0,
        done_claimed_at: null,
      });
      due.push({ kind: "new", item, attempts: 0 });
      if (item.status === STATUS_DONE) due.push({ kind: "done", item, attempts: 0 });
      continue;
    }

    if (row.last_status !== item.status) {
      statusUpdates.push({ item_id: item.id, last_status: item.status });
    }

    for (const kind of KINDS) {
      const slot = slotOf(row, kind);
      let state = slot.state;
      if (isStale(slot, now)) {
        state = slot.attempts >= MAX_ATTEMPTS ? "failed" : "pending";
        recoveries.push({ item_id: item.id, kind, state });
      }
      const wanted = kind === "new" || item.status === STATUS_DONE;
      if (wanted && state === "pending" && slot.attempts < MAX_ATTEMPTS) {
        due.push({ kind, item, attempts: slot.attempts });
      }
    }
  }

  return { inserts, statusUpdates, recoveries, due };
}
