import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateAdminClient, state } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  state: { result: { data: [] as unknown, error: null as unknown } },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

import { GET, POST } from "../route";

function builder() {
  const b: Record<string, unknown> = {
    then: (resolve: (v: unknown) => void) => resolve(state.result),
  };
  for (const m of ["select", "eq", "order", "limit", "update", "insert"]) {
    b[m] = vi.fn(() => b);
  }
  b.maybeSingle = vi.fn(() => Promise.resolve(state.result));
  return b;
}

function get(secret?: string) {
  return new Request("http://localhost/api/entertest/test-request", {
    method: "GET",
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  }) as unknown as Parameters<typeof GET>[0];
}
function post(opts: { secret?: string; body?: unknown }) {
  return new Request("http://localhost/api/entertest/test-request", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.secret ? { authorization: `Bearer ${opts.secret}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("/api/entertest/test-request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    state.result = { data: [], error: null };
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder()) });
  });

  it("GET secret 없으면 401", async () => {
    expect((await GET(get())).status).toBe(401);
  });

  it("GET pending 없으면 request: null", async () => {
    state.result = { data: [], error: null };
    const res = await GET(get("s3cr3t"));
    expect(res.status).toBe(200);
    expect((await res.json()).request).toBeNull();
  });

  it("POST secret 없으면 401", async () => {
    expect((await POST(post({ body: { id: "x", ok: true } }))).status).toBe(
      401,
    );
  });

  it("POST id 누락 시 400", async () => {
    const res = await POST(post({ secret: "s3cr3t", body: { ok: true } }));
    expect(res.status).toBe(400);
  });

  it("POST 완료 보고 → 200", async () => {
    state.result = { data: null, error: null };
    const res = await POST(
      post({
        secret: "s3cr3t",
        body: { id: "abc", ok: true, message: "done" },
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});
