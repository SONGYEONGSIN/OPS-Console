import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  pending: [] as { id: string }[],
  claimed: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
  signedUrl: "https://example.test/signed.jpg",
  /** 세우기에 넘긴 인자, 그리고 그때 판독 결과가 이미 저장됐었나 */
  straightened: [] as { args: unknown[]; savedFirst: boolean }[],
  /** 세우기가 돌려줄 결과 */
  outcome: "upright",
  /** 세운 뒤 재판독으로 확정·되돌리기에 넘긴 인자, 그때 결과가 저장됐었나 */
  settled: [] as { args: unknown[]; savedFirst: boolean }[],
  settle: "not-rotation",
};

// 누운 사진 세우기는 sideways-photo.test.ts 가 본다 — 여기서는 언제 무엇을 넘기는지만.
vi.mock("@/features/postal/sideways-photo", () => ({
  straightenSideways: (...args: unknown[]) => {
    state.straightened.push({
      args,
      savedFirst: state.updates.some((u) => u.status === "done"),
    });
    return Promise.resolve(state.outcome);
  },
  settleRotation: (...args: unknown[]) => {
    state.settled.push({
      args,
      savedFirst: state.updates.some((u) => u.status === "done" || u.status === "failed"),
    });
    return Promise.resolve(state.settle);
  },
}));

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
    state.straightened = [];
    state.outcome = "upright";
    state.settled = [];
    state.settle = "not-rotation";
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

  it("판독을 저장한 뒤 영수증 방향을 넘겨 누운 사진을 세운다 — 저장이 먼저다", async () => {
    const sideways = {
      is_receipt: true,
      total_fee: 100,
      items: [{ tracking_no: "A-1", fee: 100 }],
      receipt_top: "right",
      regions: { receipt: null, accepted_at: [0.75, 0.4, 0.8, 0.6], total_fee: [0.3, 0.5, 0.35, 0.7] },
    };
    const res = await POST(
      req({ method: "POST", auth: "Bearer s3cret", body: { id: "q1", ok: true, raw: JSON.stringify(sideways) } }),
    );
    expect(res.status).toBe(200);
    // 상자도 넘긴다 — 판독의 방향과 상자로 잰 방향이 맞을 때만 돌린다.
    expect(state.straightened).toEqual([{ args: ["q1", "right", sideways.regions], savedFirst: true }]);
  });

  it("세운 뒤의 재판독이면 그 방향으로 회전을 확정하거나 되돌린다 — 저장이 먼저다", async () => {
    const reading = { is_receipt: true, total_fee: 100, items: [{ tracking_no: "A-1", fee: 100 }], receipt_top: "top" };
    await POST(
      req({ method: "POST", auth: "Bearer s3cret", body: { id: "q2", ok: true, raw: JSON.stringify(reading) } }),
    );
    expect(state.settled).toEqual([{ args: ["q2", "top"], savedFirst: true }]);
  });

  it("재판독이 실패해도 확정·되돌리기를 부른다(방향 없음) — 확인 못 한 회전은 되돌린다", async () => {
    await POST(req({ method: "POST", auth: "Bearer s3cret", body: { id: "q2", ok: false, message: "10분 초과" } }));
    await POST(
      req({ method: "POST", auth: "Bearer s3cret", body: { id: "q3", ok: true, raw: JSON.stringify({ is_receipt: false }) } }),
    );
    expect(state.settled).toEqual([
      { args: ["q2", null], savedFirst: true },
      { args: ["q3", null], savedFirst: true },
    ]);
  });

  it("회전을 확정하거나 되돌렸으면 로그로 남긴다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    state.settle = "restored";
    await POST(req({ method: "POST", auth: "Bearer s3cret", body: { id: "q2", ok: false, message: "x" } }));
    expect(warn).toHaveBeenCalledWith("[postal] 세운 사진 확인:", "q2", "restored");
    warn.mockRestore();
  });

  it("판독이 실패하면 세우지 않는다 — 방향을 모른다", async () => {
    await POST(
      req({ method: "POST", auth: "Bearer s3cret", body: { id: "q1", ok: true, raw: JSON.stringify({ is_receipt: false }) } }),
    );
    await POST(req({ method: "POST", auth: "Bearer s3cret", body: { id: "q1", ok: false, message: "5분 초과" } }));
    expect(state.straightened).toEqual([]);
  });

  it("누운 사진이었으면 무엇을 했는지 로그로 남긴다 — 바로 선 판독은 조용하다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const reading = { is_receipt: true, total_fee: 100, items: [{ tracking_no: "A-1", fee: 100 }] };
    state.outcome = "not-landscape";
    await POST(
      req({ method: "POST", auth: "Bearer s3cret", body: { id: "q1", ok: true, raw: JSON.stringify({ ...reading, receipt_top: "right" }) } }),
    );
    expect(warn).toHaveBeenCalledWith("[postal] 누운 사진:", "q1", "not-landscape");
    warn.mockClear();
    state.outcome = "upright";
    await POST(
      req({ method: "POST", auth: "Bearer s3cret", body: { id: "q1", ok: true, raw: JSON.stringify({ ...reading, receipt_top: "top" }) } }),
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
