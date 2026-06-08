import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateAdminClient, mockInsert } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

import { POST } from "../route";

function req(opts: { secret?: string; body?: unknown } = {}) {
  return new Request("http://localhost/api/closing/run-log", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.secret ? { authorization: `Bearer ${opts.secret}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

describe("/api/closing/run-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    mockInsert.mockResolvedValue({ error: null });
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: mockInsert }),
    });
  });

  it("secret 없으면 401", async () => {
    const res = await POST(req({ body: { status: "success" } }));
    expect(res.status).toBe(401);
  });

  it("잘못된 status는 400", async () => {
    const res = await POST(req({ secret: "s3cr3t", body: { status: "nope" } }));
    expect(res.status).toBe(400);
  });

  it("success 보고 → service_count·message 적재", async () => {
    const res = await POST(
      req({
        secret: "s3cr3t",
        body: { status: "success", service_count: 12, message: "적재 완료" },
      }),
    );
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith({
      status: "success",
      service_count: 12,
      message: "적재 완료",
    });
  });

  it("failed 보고 → service_count 기본 0", async () => {
    const res = await POST(
      req({
        secret: "s3cr3t",
        body: { status: "failed", message: "로그인 타임아웃" },
      }),
    );
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith({
      status: "failed",
      service_count: 0,
      message: "로그인 타임아웃",
    });
  });
});
