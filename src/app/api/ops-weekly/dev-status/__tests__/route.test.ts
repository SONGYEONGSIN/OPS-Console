import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockCreateAdminClient, fromSpy, upsertSpy } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  fromSpy: vi.fn(),
  upsertSpy: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

import { POST } from "../route";

const row = (id: number, t = "-") => ({ service_id: id, test_open: t });

function req(opts: { secret?: string; body?: unknown; raw?: string } = {}) {
  return new Request("http://localhost/api/ops-weekly/dev-status", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.secret ? { authorization: `Bearer ${opts.secret}` } : {}),
    },
    body:
      opts.raw !== undefined
        ? opts.raw
        : opts.body === undefined
          ? undefined
          : JSON.stringify(opts.body),
  });
}

describe("/api/ops-weekly/dev-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    upsertSpy.mockResolvedValue({ error: null });
    fromSpy.mockReturnValue({ upsert: upsertSpy });
    mockCreateAdminClient.mockReturnValue({ from: fromSpy });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("CRON_SECRET 미설정이면 500", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(req({ secret: "s3cr3t", body: { rows: [row(1)] } }));
    expect(res.status).toBe(500);
  });

  it("Bearer 가 틀리면 401", async () => {
    const res = await POST(req({ secret: "nope", body: { rows: [row(1)] } }));
    expect(res.status).toBe(401);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("JSON 이 아니면 400", async () => {
    const res = await POST(req({ secret: "s3cr3t", raw: "not-json" }));
    expect(res.status).toBe(400);
  });

  it("스키마 위반이면 400 이고 쓰지 않는다", async () => {
    const res = await POST(req({ secret: "s3cr3t", body: { rows: [] } }));
    expect(res.status).toBe(400);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("upsert 한 번 — 서버 시각·원문·판정", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-18T00:30:00Z"));
    const res = await POST(
      req({
        secret: "s3cr3t",
        body: { rows: [row(1000001, "-"), row(1000002, "2026-11-10 14:00:00")] },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, received: 2, dev: 1, test: 1 });
    expect(fromSpy.mock.calls.map(([t]) => t)).toEqual(["ops_weekly_dev_status"]);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenCalledWith(
      [
        { service_id: 1000001, stage: "dev", raw_label: "-", collected_at: "2026-11-18T00:30:00.000Z" },
        { service_id: 1000002, stage: "test", raw_label: "2026-11-10 14:00:00", collected_at: "2026-11-18T00:30:00.000Z" },
      ],
      { onConflict: "service_id" },
    );
  });

  it("supabase error 면 500", async () => {
    upsertSpy.mockResolvedValue({ error: { message: "boom" } });
    const res = await POST(req({ secret: "s3cr3t", body: { rows: [row(1)] } }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "boom" });
  });
});
