import { describe, it, expect, vi, beforeEach } from "vitest";

const state = { upserts: [] as Record<string, unknown>[] };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      upsert: (row: Record<string, unknown>) => {
        state.upserts.push(row);
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

const { POST } = await import("../route");

const req = (body: unknown, auth = "Bearer s3cret") =>
  new Request("http://x/api/pollers/heartbeat", {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

/**
 * 폴러가 "살아있음"을 남기는 창구.
 *
 * 큐 기록만으로는 요청이 없을 때 생사를 알 수 없다 — 2026-08-20 밤 어시스턴트
 * 폴러가 죽었는데 12시간 동안 아무도 몰랐다.
 */
describe("POST /api/pollers/heartbeat", () => {
  beforeEach(() => {
    state.upserts = [];
    process.env.CRON_SECRET = "s3cret";
  });

  it("CRON_SECRET이 틀리면 401 — 폴러 전용이다", async () => {
    const res = await POST(req({ pollerId: "assistant" }, "Bearer wrong"));
    expect(res.status).toBe(401);
    expect(state.upserts).toHaveLength(0);
  });

  it("심박을 남긴다", async () => {
    const res = await POST(req({ pollerId: "assistant", machine: "PC-1" }));
    expect(res.status).toBe(200);
    expect(state.upserts[0].poller_id).toBe("assistant");
    expect(state.upserts[0].machine).toBe("PC-1");
    expect(typeof state.upserts[0].beat_at).toBe("string");
  });

  it("등록되지 않은 폴러 id는 거절한다 — 오타가 조용히 새 행을 만들면 안 된다", async () => {
    const res = await POST(req({ pollerId: "assistnat" }));
    expect(res.status).toBe(400);
    expect(state.upserts).toHaveLength(0);
  });

  it("id가 없으면 400", async () => {
    expect((await POST(req({}))).status).toBe(400);
  });
});
