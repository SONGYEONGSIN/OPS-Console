import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { loadSentKeys, saveReminder, summaryKey } from "../store";

const TABLE = "manual_review_reminders";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261109_manual_review_reminders.sql",
  ),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/--.*$/gm, "");
const flat = sql.replace(/\s+/g, " ").toLowerCase();

type Call = { method: string; args: unknown[] };
type Result = { data?: unknown; error?: { message: string } | null };

// 체인 목: 모든 메서드 호출을 기록하고, await 하면 result 를 돌려준다.
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
  const from = vi.fn((table: string) => {
    calls.push({ method: "from", args: [table] });
    return new Proxy({}, handler);
  });
  return { db: { from } as unknown as SupabaseClient, calls };
}

const argsOf = (calls: Call[], method: string) =>
  calls.filter((c) => c.method === method).map((c) => c.args);

describe("마이그레이션", () => {
  it("RLS 를 켜고 정책 없이 service_role 만 쓴다", () => {
    expect(flat).toContain(
      `alter table public.${TABLE} enable row level security`,
    );
    expect(flat).not.toContain("create policy");
    expect(flat).toContain(
      `revoke all on public.${TABLE} from public, anon, authenticated`,
    );
    expect(flat).toContain(`grant all on public.${TABLE} to service_role`);
  });

  it("반기 키 + 수신자 키가 기본 키이고 상태는 셋뿐이다", () => {
    expect(flat).toContain("primary key (half_key, recipient_key)");
    expect(flat).toMatch(
      /check \(status in \('sent', ?'failed', ?'dry_run'\)\)/,
    );
  });
});

describe("summaryKey", () => {
  it("관리자 요약 키는 __summary__: + 소문자 메일", () => {
    expect(summaryKey("Admin@Example.test")).toBe(
      "__summary__:admin@example.test",
    );
  });
});

describe("loadSentKeys", () => {
  it("그 반기의 sent 행만 읽는다", async () => {
    const { db, calls } = dbWith({
      data: [
        { recipient_key: "a@example.test" },
        { recipient_key: "__summary__:x@example.test" },
      ],
    });
    const keys = await loadSentKeys(db, "2026-H1");
    expect(keys).toEqual(
      new Set(["a@example.test", "__summary__:x@example.test"]),
    );
    expect(argsOf(calls, "from")).toEqual([[TABLE]]);
    expect(argsOf(calls, "eq")).toEqual([
      ["half_key", "2026-H1"],
      ["status", "sent"],
    ]);
  });

  it("조회 오류는 던진다 — 빈 집합이면 전원에게 다시 보낸다", async () => {
    const { db } = dbWith({ error: { message: "boom" } });
    await expect(loadSentKeys(db, "2026-H1")).rejects.toThrow("boom");
  });
});

describe("saveReminder", () => {
  const rec = {
    half_key: "2026-H1",
    recipient_key: "a@example.test",
    manual_count: 3,
    message_id: null,
    error: null,
  };

  it("반기 키 + 수신자 키로 덮어쓴다 — sent 면 보낸 시각을 남긴다", async () => {
    const { db, calls } = dbWith({});
    await saveReminder(db, { ...rec, status: "sent" });
    const [[payload, opts]] = argsOf(calls, "upsert") as [
      [Record<string, unknown>, { onConflict: string }],
    ];
    expect(opts.onConflict).toBe("half_key,recipient_key");
    expect(payload).toMatchObject({ ...rec, status: "sent" });
    expect(typeof payload.sent_at).toBe("string");
  });

  it("실패 기록은 보낸 시각이 없다", async () => {
    const { db, calls } = dbWith({});
    await saveReminder(db, { ...rec, status: "failed", error: "throttled" });
    const [[payload]] = argsOf(calls, "upsert") as [[Record<string, unknown>]];
    expect(payload.sent_at).toBeNull();
    expect(payload.error).toBe("throttled");
  });

  it("저장 오류는 던진다", async () => {
    const { db } = dbWith({ error: { message: "boom" } });
    await expect(saveReminder(db, { ...rec, status: "sent" })).rejects.toThrow(
      "boom",
    );
  });
});
