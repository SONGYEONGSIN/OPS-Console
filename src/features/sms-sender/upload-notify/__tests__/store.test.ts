import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  claimUpload,
  fillHashes,
  finishUploads,
  insertUploadRows,
  loadUploadRows,
  rearmUploads,
  recoverUploads,
  seedUploads,
  updateHashes,
} from "../store";
import type { Rearm, UploadInsert } from "../types";

const TABLE = "sms_sender_doc_upload_notices";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261106_sms_sender_doc_upload_notices.sql",
  ),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/--.*$/gm, "");

type Call = { chain: number; method: string; args: unknown[] };
type Result = { data?: unknown; error?: { message: string } | null };

// 체인 목: from() 호출마다 새 체인을 만들고, n번째 체인은 results[n] 을 돌려준다
// (모자라면 마지막 값). 모든 메서드 호출을 체인 번호와 함께 기록한다.
function dbSeq(results: Result[]) {
  const calls: Call[] = [];
  let chains = 0;
  const from = vi.fn(() => {
    const chain = chains++;
    const result = results[Math.min(chain, results.length - 1)] ?? {};
    const handler: ProxyHandler<object> = {
      get(target, prop: string) {
        if (prop === "then") {
          return (res: (v: unknown) => unknown) =>
            res({ data: result.data ?? null, error: result.error ?? null });
        }
        return (...args: unknown[]) => {
          calls.push({ chain, method: prop, args });
          return new Proxy(target, handler);
        };
      },
    };
    return new Proxy({}, handler);
  });
  return { db: { from } as unknown as SupabaseClient, calls, from };
}
const dbWith = (result: Result) => dbSeq([result]);

const argsOf = (calls: Call[], method: string) =>
  calls.filter((c) => c.method === method).map((c) => c.args);
const updatePayload = (calls: Call[]) =>
  calls.find((c) => c.method === "update")?.args[0] as Record<string, unknown>;

const now = new Date("2026-11-06T01:00:00Z");

const insert = (id: string): UploadInsert => ({
  item_id: id,
  name: `${id}.pdf`,
  folder_path: "진행 중",
  web_url: null,
  content_hash: "h",
  change_kind: "new",
  state: "pending",
  attempts: 0,
});

describe("마이그레이션", () => {
  const body = (
    /create table[^(]*\(([\s\S]*)\)\s*;/i.exec(sql)?.[1] ?? ""
  ).replace(/\s+/g, " ");
  it("테이블·PK·RLS·권한, 정책 없음", () => {
    expect(sql).toContain(`create table if not exists public.${TABLE}`);
    expect(body).toContain("item_id text primary key");
    expect(sql).toContain(
      `alter table public.${TABLE} enable row level security`,
    );
    expect(sql).toContain(
      `revoke all on public.${TABLE} from public, anon, authenticated`,
    );
    expect(sql).toContain(`grant all on public.${TABLE} to service_role`);
    expect(sql).not.toMatch(/create policy/i);
  });
  it("상태 7값·변경 종류 check", () => {
    expect(body).toContain(
      "check (state in ('seeded','skipped_self','pending','sending','sent','failed','dry_run'))",
    );
    expect(body).toContain("check (change_kind in ('new','replaced'))");
    for (const c of [
      "content_hash",
      "attempts",
      "claimed_at",
      "sent_at",
      "message_id",
      "error",
    ]) {
      expect(body).toContain(`${c} `);
    }
  });
  it("올린 사람 메일 칸이 없다", () => {
    expect(body).not.toMatch(/email/i);
  });
});

describe("loadUploadRows", () => {
  it("1000행이 차면 다음 쪽을 더 읽는다", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      item_id: `a${i}`,
    }));
    const page2 = [{ item_id: "b1" }, { item_id: "b2" }, { item_id: "b3" }];
    const { db, calls, from } = dbSeq([{ data: page1 }, { data: page2 }]);
    const rows = await loadUploadRows(db);
    expect(rows).toHaveLength(1003);
    expect(from).toHaveBeenCalledWith(TABLE);
    expect(argsOf(calls, "range")).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(argsOf(calls, "order")[0]?.[0]).toBe("item_id");
  });
  it("1000행 미만이면 한 쪽만 읽는다", async () => {
    const { db, calls } = dbSeq([{ data: [{ item_id: "1" }] }]);
    await expect(loadUploadRows(db)).resolves.toEqual([{ item_id: "1" }]);
    expect(argsOf(calls, "range")).toEqual([[0, 999]]);
  });
  it("loadUploadRows 는 error 가 있으면 던진다", async () => {
    const { db } = dbWith({ error: { message: "boom" } });
    await expect(loadUploadRows(db)).rejects.toThrow("boom");
  });
});

describe("seedUploads", () => {
  it("첫 실행 적재는 나누지 않고 upsert 한 번 — 중간 실패로 반쯤 적재되지 않게", async () => {
    const { db, calls } = dbWith({});
    const rows = Array.from({ length: 1001 }, (_, i) => insert(`s${i}`));
    await seedUploads(db, rows);
    const upserts = argsOf(calls, "upsert");
    expect(upserts).toHaveLength(1);
    expect((upserts[0]?.[0] as unknown[]).length).toBe(1001);
    expect(upserts[0]?.[1]).toEqual({
      onConflict: "item_id",
      ignoreDuplicates: true,
    });
  });
  it("빈 배열이면 호출하지 않는다", async () => {
    const { db, calls } = dbWith({});
    await seedUploads(db, []);
    expect(calls).toEqual([]);
  });
  it("error 면 던진다", async () => {
    const { db } = dbWith({ error: { message: "s" } });
    await expect(seedUploads(db, [insert("1")])).rejects.toThrow("s");
  });
});

describe("insertUploadRows", () => {
  it("빈 배열이면 호출하지 않는다", async () => {
    const { db, calls } = dbWith({});
    await insertUploadRows(db, []);
    expect(calls).toEqual([]);
  });
  it("insertUploadRows 는 500행씩 나눈다", async () => {
    const { db, calls } = dbWith({});
    const rows = Array.from({ length: 1001 }, (_, i) => insert(`i${i}`));
    await insertUploadRows(db, rows);
    const upserts = argsOf(calls, "upsert");
    expect(upserts).toHaveLength(3);
    expect((upserts[0]?.[0] as unknown[]).length).toBe(500);
    expect((upserts[2]?.[0] as unknown[]).length).toBe(1);
    expect(upserts[0]?.[1]).toEqual({
      onConflict: "item_id",
      ignoreDuplicates: true,
    });
  });
  it("error 면 던진다", async () => {
    const { db } = dbWith({ error: { message: "x" } });
    await expect(insertUploadRows(db, [insert("1")])).rejects.toThrow("x");
  });
});

describe("rearmUploads", () => {
  const rearm: Rearm = {
    item_id: "1",
    prevHash: "old",
    name: "a.pdf",
    folder_path: "진행 중",
    web_url: null,
    content_hash: "new",
    change_kind: "replaced",
    state: "pending",
    prevState: "sent",
  };
  it("rearmUploads 조건", async () => {
    const { db, calls } = dbWith({});
    await rearmUploads(db, [rearm], now);
    expect(argsOf(calls, "eq")).toContainEqual(["item_id", "1"]);
    expect(argsOf(calls, "eq")).toContainEqual(["content_hash", "old"]);
    // 스냅샷의 상태 그대로일 때만 — 겹친 실행이 그새 옮긴 행은 다음 실행으로.
    expect(argsOf(calls, "eq")).toContainEqual(["state", "sent"]);
    expect(argsOf(calls, "neq")).toContainEqual(["state", "sending"]);
    expect(updatePayload(calls)).toMatchObject({
      content_hash: "new",
      change_kind: "replaced",
      state: "pending",
      attempts: 0,
      error: null,
      claimed_at: null,
      updated_at: now.toISOString(),
    });
    expect(updatePayload(calls)).not.toHaveProperty("prevHash");
    expect(updatePayload(calls)).not.toHaveProperty("prevState");
  });
  it("error 면 던진다", async () => {
    const { db } = dbWith({ error: { message: "r" } });
    await expect(rearmUploads(db, [rearm], now)).rejects.toThrow("r");
  });
});

describe("fillHashes", () => {
  it("저장 해시가 null 인 행만 채운다", async () => {
    const { db, calls } = dbWith({});
    await fillHashes(db, [{ item_id: "1", content_hash: "h" }], now);
    expect(argsOf(calls, "eq")).toContainEqual(["item_id", "1"]);
    expect(argsOf(calls, "is")).toContainEqual(["content_hash", null]);
    expect(updatePayload(calls)).toMatchObject({ content_hash: "h" });
  });
  it("error 면 던진다", async () => {
    const { db } = dbWith({ error: { message: "f" } });
    await expect(
      fillHashes(db, [{ item_id: "1", content_hash: "h" }], now),
    ).rejects.toThrow("f");
  });
});

describe("updateHashes", () => {
  it("이전 해시가 맞을 때만 해시만 바꾼다 (상태는 안 건드림)", async () => {
    const { db, calls } = dbWith({});
    await updateHashes(
      db,
      [{ item_id: "1", prevHash: "old", content_hash: "new" }],
      now,
    );
    expect(argsOf(calls, "eq")).toContainEqual(["item_id", "1"]);
    expect(argsOf(calls, "eq")).toContainEqual(["content_hash", "old"]);
    expect(updatePayload(calls)).toEqual({
      content_hash: "new",
      updated_at: now.toISOString(),
    });
  });
  it("error 면 던진다", async () => {
    const { db } = dbWith({ error: { message: "u" } });
    await expect(
      updateHashes(
        db,
        [{ item_id: "1", prevHash: "o", content_hash: "n" }],
        now,
      ),
    ).rejects.toThrow("u");
  });
});

describe("recoverUploads", () => {
  it("여전히 sending 이고 30분 지난 행만 되돌린다", async () => {
    const { db, calls } = dbWith({});
    await recoverUploads(db, [{ item_id: "1", state: "failed" }], now);
    expect(argsOf(calls, "eq")).toContainEqual(["item_id", "1"]);
    expect(argsOf(calls, "eq")).toContainEqual(["state", "sending"]);
    expect(argsOf(calls, "lt")).toContainEqual([
      "claimed_at",
      "2026-11-06T00:30:00.000Z",
    ]);
    expect(updatePayload(calls)).toMatchObject({ state: "failed" });
  });
  it("error 면 던진다", async () => {
    const { db } = dbWith({ error: { message: "v" } });
    await expect(
      recoverUploads(db, [{ item_id: "1", state: "pending" }], now),
    ).rejects.toThrow("v");
  });
});

describe("claimUpload", () => {
  it("claimUpload 은 state=pending·attempts 조건, 1행이면 true", async () => {
    const { db, calls } = dbWith({ data: [{ item_id: "1" }] });
    await expect(claimUpload(db, "1", 2, now)).resolves.toBe(true);
    expect(argsOf(calls, "eq")).toContainEqual(["item_id", "1"]);
    expect(argsOf(calls, "eq")).toContainEqual(["state", "pending"]);
    expect(argsOf(calls, "eq")).toContainEqual(["attempts", 2]);
    const m = calls.map((c) => c.method);
    expect(m.indexOf("select")).toBeGreaterThan(m.indexOf("update"));
    expect(updatePayload(calls)).toMatchObject({
      state: "sending",
      attempts: 3,
      claimed_at: now.toISOString(),
    });
  });
  it("0행이면 false", async () => {
    const { db } = dbWith({ data: [] });
    await expect(claimUpload(db, "1", 0, now)).resolves.toBe(false);
  });
  it("error 면 던진다", async () => {
    const { db } = dbWith({ error: { message: "c" } });
    await expect(claimUpload(db, "1", 0, now)).rejects.toThrow("c");
  });
});

describe("finishUploads", () => {
  it("finishUploads 는 sending 인 id 만 갱신하고 갱신된 id 를 돌려준다", async () => {
    const { db, calls } = dbWith({ data: [{ item_id: "1" }] });
    const done = await finishUploads(db, ["1", "2"], { state: "pending", now });
    expect(done).toEqual(["1"]);
    expect(argsOf(calls, "in")).toContainEqual(["item_id", ["1", "2"]]);
    expect(argsOf(calls, "eq")).toContainEqual(["state", "sending"]);
    const m = calls.map((c) => c.method);
    expect(m.indexOf("select")).toBeGreaterThan(m.indexOf("update"));
  });
  it("id 는 100개씩 나눠 갱신하고 돌려받은 id 를 합친다 (URL 길이)", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id${i}`);
    const { db, calls, from } = dbSeq([
      { data: [{ item_id: "id0" }] },
      { data: [{ item_id: "id100" }, { item_id: "id101" }] },
      { data: [{ item_id: "id249" }] },
    ]);
    const done = await finishUploads(db, ids, { state: "sent", now });
    expect(from).toHaveBeenCalledTimes(3);
    const ins = argsOf(calls, "in").map((a) => (a[1] as string[]).length);
    expect(ins).toEqual([100, 100, 50]);
    expect(done).toEqual(["id0", "id100", "id101", "id249"]);
  });
  it("빈 ids 는 db 를 안 부른다", async () => {
    const { db, from } = dbWith({});
    await expect(
      finishUploads(db, [], { state: "sent", now }),
    ).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
  it("sent 면 sent_at·message_id, error 500자 자름", async () => {
    const sent = dbWith({ data: [{ item_id: "1" }] });
    await finishUploads(sent.db, ["1"], { state: "sent", messageId: "m", now });
    expect(updatePayload(sent.calls)).toMatchObject({
      state: "sent",
      sent_at: now.toISOString(),
      message_id: "m",
      error: null,
    });
    const failed = dbWith({ data: [{ item_id: "1" }] });
    await finishUploads(failed.db, ["1"], {
      state: "failed",
      error: "e".repeat(900),
      now,
    });
    const payload = updatePayload(failed.calls);
    expect((payload.error as string).length).toBe(500);
    expect(payload).not.toHaveProperty("sent_at");
  });
  it("error 면 던진다", async () => {
    const { db } = dbWith({ error: { message: "f" } });
    await expect(
      finishUploads(db, ["1"], { state: "pending", now }),
    ).rejects.toThrow("f");
  });
});
