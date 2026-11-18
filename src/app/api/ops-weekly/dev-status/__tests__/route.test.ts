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

const row = (id: number, t = "-", r = "-") => ({
  service_id: id,
  test_open: t,
  real_deploy: r,
});

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

  it("빈 본문 {} 은 400 JSON ok:false — 수집기 사전 확인(collect.py preflight)이 이 응답을 본다", async () => {
    const res = await POST(req({ secret: "s3cr3t", body: {} }));
    expect(res.status).toBe(400);
    expect((await res.json()).ok).toBe(false);
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
    expect(await res.json()).toEqual({
      ok: true,
      received: 2,
      dev: 1,
      test: 1,
      deployed: 0,
    });
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

  it("리얼배포 일시가 있으면 deployed — raw_label 은 테스트 오픈 원문 그대로", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-18T00:30:00Z"));
    const res = await POST(
      req({
        secret: "s3cr3t",
        body: {
          rows: [
            row(1000001, "-"),
            row(1000002, "2026-11-10 14:00:00"),
            row(1000003, "2026-11-10 14:00:00", "2026-11-12 09:00:00"),
            row(1000004, "-", "2026-11-13 10:30:00"),
          ],
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      received: 4,
      dev: 1,
      test: 1,
      deployed: 2,
    });
    const at = "2026-11-18T00:30:00.000Z";
    expect(upsertSpy).toHaveBeenCalledWith(
      [
        { service_id: 1000001, stage: "dev", raw_label: "-", collected_at: at },
        { service_id: 1000002, stage: "test", raw_label: "2026-11-10 14:00:00", collected_at: at },
        { service_id: 1000003, stage: "deployed", raw_label: "2026-11-10 14:00:00", collected_at: at },
        { service_id: 1000004, stage: "deployed", raw_label: "-", collected_at: at },
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
