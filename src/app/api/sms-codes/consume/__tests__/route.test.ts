import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  calls: [] as { fn: string; args: unknown }[],
  result: {
    data: null as unknown,
    error: null as { message: string; code?: string } | null,
  },
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: (fn: string, args: unknown) => {
      state.calls.push({ fn, args });
      return Promise.resolve(state.result);
    },
  }),
}));

const { POST } = await import("../route");

const req = (body: unknown, auth: string | null = "Bearer s3cret") =>
  new Request("http://x/api/sms-codes/consume", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

/**
 * 스크래퍼(회사 PC)가 우편함을 비우고(reset = 점유 획득) 꺼내는(pop) 창구.
 * `Authorization: Bearer ${CRON_SECRET}`.
 */
describe("POST /api/sms-codes/consume", () => {
  beforeEach(() => {
    state.calls = [];
    state.result = { data: null, error: null };
    process.env.CRON_SECRET = "s3cret";
  });

  it("CRON_SECRET 이 틀리면 401 — DB 에 손대지 않는다", async () => {
    const res = await POST(
      req({ action: "pop", consumer: "closing" }, "Bearer wrong"),
    );
    expect(res.status).toBe(401);
    expect(state.calls).toHaveLength(0);
  });

  it("Authorization 헤더가 없어도 401", async () => {
    const res = await POST(req({ action: "pop", consumer: "closing" }, null));
    expect(res.status).toBe(401);
    expect(state.calls).toHaveLength(0);
  });

  it("CRON_SECRET 미설정이면 500 — 열린 창구가 되면 안 된다", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(req({ action: "pop", consumer: "closing" }));
    expect(res.status).toBe(500);
    expect(state.calls).toHaveLength(0);
  });

  it("consumer 오타는 400 — 이름이 곧 리스라 오타가 점유를 무력화한다", async () => {
    const res = await POST(req({ action: "reset", consumer: "closng" }));
    expect(res.status).toBe(400);
    expect(state.calls).toHaveLength(0);
  });

  it("모르는 action 은 400", async () => {
    expect(
      (await POST(req({ action: "peek", consumer: "closing" }))).status,
    ).toBe(400);
  });

  it("JSON 이 아니면 400", async () => {
    expect((await POST(req("not json"))).status).toBe(400);
  });

  it("reset — 비우기 + 점유. 지운 건수를 돌려준다", async () => {
    state.result = {
      data: [
        {
          acquired: true,
          holder: "closing",
          holder_since: "2026-09-11T00:00:00Z",
          cleared: 1,
        },
      ],
      error: null,
    };
    const res = await POST(req({ action: "reset", consumer: "closing" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, cleared: 1 });
    expect(state.calls).toEqual([
      {
        fn: "claim_sms_inbox",
        args: { p_consumer: "closing", p_ttl_sec: 180 },
      },
    ]);
  });

  it("reset — 남이 점유 중이면 409 + 누가 언제부터", async () => {
    state.result = {
      data: [
        {
          acquired: false,
          holder: "ratio-audit",
          holder_since: "2026-09-11T00:00:12Z",
          cleared: 0,
        },
      ],
      error: null,
    };
    const res = await POST(req({ action: "reset", consumer: "closing" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false,
      error: "lease-held",
      holder: "ratio-audit",
      holderSince: "2026-09-11T00:00:12Z",
    });
  });

  it("reset — 함수가 행을 안 돌려주면 500. 점유 여부를 모른 채 진행하면 안 된다", async () => {
    state.result = { data: null, error: null };
    expect(
      (await POST(req({ action: "reset", consumer: "closing" }))).status,
    ).toBe(500);
  });

  it("pop — 최신 1건을 꺼내 돌려준다", async () => {
    state.result = {
      data: [{ code: "130753", received_at: "2026-09-11T00:00:07Z" }],
      error: null,
    };
    const res = await POST(req({ action: "pop", consumer: "closing" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      code: "130753",
      receivedAt: "2026-09-11T00:00:07Z",
    });
    expect(state.calls).toEqual([
      { fn: "pop_sms_code", args: { p_consumer: "closing" } },
    ]);
  });

  it("pop — 아직 안 왔으면 200 code:null. 호출자가 계속 기다린다", async () => {
    state.result = { data: [], error: null };
    const res = await POST(req({ action: "pop", consumer: "closing" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, code: null });
  });

  it("pop — data 가 null 로 와도 빈 우편함으로 본다(code:null)", async () => {
    state.result = { data: null, error: null };
    const res = await POST(req({ action: "pop", consumer: "closing" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, code: null });
  });

  it("pop — 점유자가 아니면 409 lease-not-held. 0행으로 주면 '아직 안 왔다'와 구분이 안 돼 90초를 태운다", async () => {
    state.result = {
      data: null,
      error: {
        message: "sms inbox lease not held by closing (holder=ratio-audit)",
        code: "55P03",
      },
    };
    const res = await POST(req({ action: "pop", consumer: "closing" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "lease-not-held" });
  });

  it("DB 오류는 500 — 스크래퍼가 make 로 넘어갈 수 있게 실패를 드러낸다", async () => {
    state.result = { data: null, error: { message: "boom" } };
    expect(
      (await POST(req({ action: "reset", consumer: "closing" }))).status,
    ).toBe(500);
  });
});
