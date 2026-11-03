import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  applyRecoveries,
  claimNotice,
  finishNotice,
  insertNoticeRows,
  loadNoticeRows,
  updateLastStatus,
} from "../store";
import type { NoticeRow } from "../types";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261103_sms_sender_request_notices.sql",
  ),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/--.*$/gm, "");

type Call = { method: string; args: unknown[] };
type Result = { data?: unknown; error?: { message: string } | null };

// 체인 목: 모든 메서드를 기록하고, await 시 result 를 돌려준다.
function dbWith(result: Result) {
  const calls: Call[] = [];
  const handler: ProxyHandler<object> = {
    get(target, prop: string) {
      if (prop === "then") {
        return (res: (v: unknown) => unknown) =>
          res({ data: result.data ?? null, error: result.error ?? null });
      }
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
        return new Proxy(target, handler);
      };
    },
  };
  const q = new Proxy({}, handler);
  const from = vi.fn(() => q);
  return { db: { from } as unknown as SupabaseClient, calls };
}

const eqs = (calls: Call[]) =>
  calls.filter((c) => c.method === "eq").map((c) => c.args);
const updatePayload = (calls: Call[]) =>
  calls.find((c) => c.method === "update")?.args[0];

const row: NoticeRow = {
  item_id: "1",
  last_status: "요청",
  new_state: "pending",
  new_attempts: 0,
  new_claimed_at: null,
  done_state: "seeded",
  done_attempts: 0,
  done_claimed_at: null,
};

describe("마이그레이션", () => {
  it("테이블·PK·RLS, 정책 없음", () => {
    expect(sql).toContain(
      "create table if not exists public.sms_sender_request_notices",
    );
    expect(sql).toContain("item_id text primary key");
    expect(sql).toContain("enable row level security");
    expect(sql).not.toMatch(/create policy/i);
  });
  it("상태 check 에 6개 값, kind 별 컬럼", () => {
    for (const v of [
      "pending",
      "sending",
      "sent",
      "dry_run",
      "seeded",
      "failed",
    ]) {
      expect(sql).toContain(`'${v}'`);
    }
    for (const k of ["new", "done"]) {
      for (const c of [
        "state",
        "attempts",
        "claimed_at",
        "sent_at",
        "message_id",
        "error",
      ]) {
        expect(sql).toContain(`${k}_${c} `);
      }
    }
  });
  it("신청자 정보 컬럼이 없다", () => {
    expect(sql).not.toMatch(/applicant/i);
    expect(sql).not.toMatch(/email/i);
  });
});

describe("loadNoticeRows", () => {
  it("error 가 있으면 throw", async () => {
    const { db } = dbWith({ error: { message: "boom" } });
    await expect(loadNoticeRows(db)).rejects.toThrow("boom");
  });
  it("행을 돌려준다", async () => {
    const { db } = dbWith({ data: [{ item_id: "1" }] });
    await expect(loadNoticeRows(db)).resolves.toEqual([{ item_id: "1" }]);
  });
});

describe("insertNoticeRows", () => {
  it("빈 배열이면 호출하지 않는다", async () => {
    const { db, calls } = dbWith({});
    await insertNoticeRows(db, []);
    expect(calls).toEqual([]);
  });
  it("충돌 무시 upsert", async () => {
    const { db, calls } = dbWith({});
    await insertNoticeRows(db, [row]);
    expect(calls[0]).toEqual({
      method: "upsert",
      args: [[row], { onConflict: "item_id", ignoreDuplicates: true }],
    });
  });
  it("error 면 throw", async () => {
    const { db } = dbWith({ error: { message: "x" } });
    await expect(insertNoticeRows(db, [row])).rejects.toThrow("x");
  });
});

describe("updateLastStatus", () => {
  it("item_id 조건으로 갱신", async () => {
    const { db, calls } = dbWith({});
    await updateLastStatus(db, [{ item_id: "1", last_status: "완료" }]);
    expect(eqs(calls)).toContainEqual(["item_id", "1"]);
    expect(updatePayload(calls)).toMatchObject({ last_status: "완료" });
  });
  it("error 면 throw", async () => {
    const { db } = dbWith({ error: { message: "u" } });
    await expect(
      updateLastStatus(db, [{ item_id: "1", last_status: "완료" }]),
    ).rejects.toThrow("u");
  });
});

describe("applyRecoveries", () => {
  it("여전히 sending 인 칸만 갱신", async () => {
    const { db, calls } = dbWith({});
    await applyRecoveries(db, [{ item_id: "1", kind: "new", state: "failed" }]);
    expect(eqs(calls)).toContainEqual(["item_id", "1"]);
    expect(eqs(calls)).toContainEqual(["new_state", "sending"]);
    expect(updatePayload(calls)).toEqual(
      expect.objectContaining({ new_state: "failed" }),
    );
  });
});

describe("claimNotice", () => {
  const now = new Date("2026-11-03T00:00:00Z");
  it("pending + attempts 조건, 1행이면 true", async () => {
    const { db, calls } = dbWith({ data: [{ item_id: "1" }] });
    await expect(claimNotice(db, "1", "done", 2, now)).resolves.toBe(true);
    expect(eqs(calls)).toContainEqual(["item_id", "1"]);
    expect(eqs(calls)).toContainEqual(["done_state", "pending"]);
    expect(eqs(calls)).toContainEqual(["done_attempts", 2]);
    expect(updatePayload(calls)).toMatchObject({
      done_state: "sending",
      done_attempts: 3,
      done_claimed_at: now.toISOString(),
    });
  });
  it("0행이면 false", async () => {
    const { db } = dbWith({ data: [] });
    await expect(claimNotice(db, "1", "new", 0, now)).resolves.toBe(false);
  });
  it("error 면 throw", async () => {
    const { db } = dbWith({ error: { message: "c" } });
    await expect(claimNotice(db, "1", "new", 0, now)).rejects.toThrow("c");
  });
});

describe("finishNotice", () => {
  const now = new Date("2026-11-03T00:00:00Z");
  it("sent 이면 sent_at·message_id", async () => {
    const { db, calls } = dbWith({});
    await finishNotice(db, "1", "new", { state: "sent", messageId: "m", now });
    expect(updatePayload(calls)).toMatchObject({
      new_state: "sent",
      new_sent_at: now.toISOString(),
      new_message_id: "m",
    });
  });
  it("오류는 500자로 자르고 sending 칸만 갱신", async () => {
    const { db, calls } = dbWith({});
    await finishNotice(db, "1", "done", {
      state: "failed",
      error: "e".repeat(900),
      now,
    });
    const payload = updatePayload(calls) as Record<string, unknown>;
    expect((payload.done_error as string).length).toBe(500);
    expect(eqs(calls)).toContainEqual(["done_state", "sending"]);
  });
  it("error 면 throw", async () => {
    const { db } = dbWith({ error: { message: "f" } });
    await expect(
      finishNotice(db, "1", "new", { state: "pending", now }),
    ).rejects.toThrow("f");
  });
});
