import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  pending: [] as { id: string }[],
  claimed: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
  signedUrl: "https://example.test/signed.jpg",
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: state.pending }),
        update: (p: Record<string, unknown>) => {
          state.updates.push(p);
          return chain;
        },
        maybeSingle: () => Promise.resolve({ data: state.claimed, error: null }),
        then: (r: (v: { error: null }) => unknown) => r({ error: null }),
      };
      return chain;
    },
    storage: {
      from: () => ({
        createSignedUrl: () =>
          Promise.resolve({ data: { signedUrl: state.signedUrl }, error: null }),
      }),
    },
  }),
}));

const { GET, POST } = await import("../route");

const req = (init: { method: string; body?: unknown; auth?: string }) =>
  new Request("http://x/api/postal/extract", {
    method: init.method,
    headers: init.auth ? { authorization: init.auth } : {},
    body: init.body ? JSON.stringify(init.body) : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe("영수증 판독 폴러 endpoint", () => {
  beforeEach(() => {
    state.pending = [];
    state.claimed = null;
    state.updates = [];
    process.env.CRON_SECRET = "s3cret";
  });

  it("CRON_SECRET이 틀리면 401 — 회사 PC 폴러 전용이다", async () => {
    expect((await GET(req({ method: "GET", auth: "Bearer no" }))).status).toBe(401);
  });

  it("대기 요청이 없으면 request: null", async () => {
    const body = await (await GET(req({ method: "GET", auth: "Bearer s3cret" }))).json();
    expect(body.request).toBeNull();
  });

  it("claim하면 서명 URL과 프롬프트를 함께 준다 — 폴러는 받아서 실행만 한다", async () => {
    state.pending = [{ id: "q1" }];
    state.claimed = {
      id: "q1",
      receipt_id: "r1",
      postal_receipts: { storage_path: "2026-08-19/a.jpg" },
    };
    const body = await (await GET(req({ method: "GET", auth: "Bearer s3cret" }))).json();
    expect(body.request.id).toBe("q1");
    expect(body.request.imageUrl).toBe(state.signedUrl);
    expect(body.request.prompt).toContain("등기 영수증");
    expect(state.updates[0].status).toBe("running");
  });

  it("판독 결과를 저장한다 — 검산 경고도 함께", async () => {
    const good = {
      is_receipt: true,
      receipt_no: "11127268",
      accepted_at: "2026-08-18 16:24",
      total_fee: 999,
      item_count: 1,
      items: [{ tracking_no: "A-1", fee: 100, postal_code: "12345", recipient_org: "우석대", recipient_name: "강정화" }],
    };
    const res = await POST(
      req({ method: "POST", auth: "Bearer s3cret", body: { id: "q1", ok: true, raw: JSON.stringify(good) } }),
    );
    expect(res.status).toBe(200);
    const patch = state.updates[0];
    expect(patch.status).toBe("done");
    expect(String(patch.warnings)).toMatch(/합계/);
  });

  it("영수증이 아니면 실패로 닫는다 — 화면 캡처를 올린 적이 있다", async () => {
    await POST(
      req({ method: "POST", auth: "Bearer s3cret", body: { id: "q1", ok: true, raw: JSON.stringify({ is_receipt: false }) } }),
    );
    expect(state.updates[0].status).toBe("failed");
    expect(String(state.updates[0].message)).toMatch(/영수증/);
  });

  it("폴러가 실패를 보고하면 사유를 남긴다", async () => {
    await POST(req({ method: "POST", auth: "Bearer s3cret", body: { id: "q1", ok: false, message: "3분 초과" } }));
    expect(state.updates[0].status).toBe("failed");
    expect(state.updates[0].message).toBe("3분 초과");
  });

  it("id가 없으면 400", async () => {
    expect((await POST(req({ method: "POST", auth: "Bearer s3cret", body: { ok: true } }))).status).toBe(400);
  });
});
