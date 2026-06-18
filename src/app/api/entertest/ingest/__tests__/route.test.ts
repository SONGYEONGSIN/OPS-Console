import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateAdminClient, state } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  state: { result: { data: null as unknown, error: null as unknown } },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

import { POST } from "../route";

function builder() {
  const b: Record<string, unknown> = {
    then: (resolve: (v: unknown) => void) => resolve(state.result),
  };
  for (const m of ["update", "eq", "select"]) b[m] = vi.fn(() => b);
  return b;
}

function post(opts: { secret?: string; body?: unknown }) {
  return new Request("http://localhost/api/entertest/ingest", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.secret ? { authorization: `Bearer ${opts.secret}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }) as unknown as Parameters<typeof POST>[0];
}

const VALID = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "done",
  checks: [
    { key: "login", label: "로그인", status: "pass", message: null },
    { key: "pay", label: "결제", status: "fail", message: "타임아웃" },
  ],
};

describe("/api/entertest/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    state.result = { data: null, error: null };
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder()) });
  });

  it("secret 없으면 401", async () => {
    expect((await POST(post({ body: VALID }))).status).toBe(401);
  });

  it("잘못된 페이로드 400", async () => {
    const res = await POST(post({ secret: "s3cr3t", body: { id: "nope" } }));
    expect(res.status).toBe(400);
  });

  it("유효 페이로드 → 200 + summary 반환", async () => {
    const res = await POST(post({ secret: "s3cr3t", body: VALID }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.summary).toEqual({ pass: 1, fail: 1, total: 2 });
  });
});
