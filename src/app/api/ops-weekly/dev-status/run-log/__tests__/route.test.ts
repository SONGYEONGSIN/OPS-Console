import { describe, it, expect, vi, beforeEach } from "vitest";

const { recordSpy } = vi.hoisted(() => ({ recordSpy: vi.fn() }));

vi.mock("@/features/automations/run-recorder", () => ({
  recordAutomationRun: recordSpy,
}));

import { POST } from "../route";

function req(opts: { secret?: string; body?: unknown; raw?: string } = {}) {
  return new Request("http://localhost/api/ops-weekly/dev-status/run-log", {
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

describe("/api/ops-weekly/dev-status/run-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    recordSpy.mockResolvedValue(undefined);
  });

  it("CRON_SECRET 미설정이면 500", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(
      req({ secret: "s3cr3t", body: { status: "success", message: "" } }),
    );
    expect(res.status).toBe(500);
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it("Bearer 가 틀리면 401", async () => {
    const res = await POST(
      req({ secret: "nope", body: { status: "success", message: "" } }),
    );
    expect(res.status).toBe(401);
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it("JSON 이 아니면 400", async () => {
    const res = await POST(req({ secret: "s3cr3t", raw: "not-json" }));
    expect(res.status).toBe(400);
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["skipped 는 받지 않는다", { status: "skipped", message: "" }],
    ["1,001자", { status: "failed", message: "x".repeat(1001) }],
  ])("400: %s", async (_, body) => {
    const res = await POST(req({ secret: "s3cr3t", body }));
    expect(res.status).toBe(400);
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it("success → ok:true 로 기록", async () => {
    const res = await POST(
      req({ secret: "s3cr3t", body: { status: "success", message: "수집 2건" } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(recordSpy).toHaveBeenCalledWith("ops-weekly-dev-status", {
      ok: true,
      message: "수집 2건",
    });
  });

  it("failed → ok:false 로 기록", async () => {
    const res = await POST(
      req({ secret: "s3cr3t", body: { status: "failed", message: "로그인 실패" } }),
    );
    expect(res.status).toBe(200);
    expect(recordSpy).toHaveBeenCalledWith("ops-weekly-dev-status", {
      ok: false,
      message: "로그인 실패",
    });
  });
});
