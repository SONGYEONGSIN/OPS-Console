import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  inserts: [] as Record<string, unknown>[],
  insertError: null as { message: string } | null,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        state.inserts.push(row);
        return Promise.resolve({ error: state.insertError });
      },
    }),
  }),
}));

const { POST } = await import("../route");

const MOA = "[Web발신][내부관리자] 본인확인 인증번호는 [130753] 입니다.";

const req = (body: string, auth = "Bearer ph0ne") =>
  new Request("http://x/api/sms-codes/inbound", {
    method: "POST",
    headers: {
      authorization: auth,
      "content-type": "text/plain; charset=utf-8",
    },
    body,
  });

/**
 * 폰(Tasker)이 문자 원문을 넣는 창구.
 *
 * 개인 문자가 섞여 올 수 있으므로 **본문은 저장도, 응답 에코도 하지 않는다.**
 * 서버가 코드만 뽑아 넣는다.
 */
describe("POST /api/sms-codes/inbound", () => {
  beforeEach(() => {
    state.inserts = [];
    state.insertError = null;
    process.env.SMS_INGEST_SECRET = "ph0ne";
  });

  it("키가 틀리면 401 — 아무것도 저장하지 않는다", async () => {
    const res = await POST(req(MOA, "Bearer wrong"));
    expect(res.status).toBe(401);
    expect(state.inserts).toHaveLength(0);
  });

  it("SMS_INGEST_SECRET 미설정이면 500 — 열린 창구가 되면 안 된다", async () => {
    delete process.env.SMS_INGEST_SECRET;
    const res = await POST(req(MOA));
    expect(res.status).toBe(500);
    expect(state.inserts).toHaveLength(0);
  });

  it("인증문자면 코드만 저장한다 — 행에 본문이 없다", async () => {
    const res = await POST(req(MOA));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, stored: true });
    expect(state.inserts).toEqual([{ code: "130753" }]);
  });

  it("인증문자가 아니면 조용히 무시 — 2xx 라야 Tasker 가 재시도하지 않는다", async () => {
    const ad = "[Web발신] 신년 할인 [2026]원 — 지금 확인하세요";
    const res = await POST(req(ad));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, stored: false });
    expect(state.inserts).toHaveLength(0);
  });

  it("너무 긴 문자도 조용히 무시 — 400 이면 Tasker 가 그 개인 문자를 다시 보낸다", async () => {
    const long = `인증번호는 [130753] 입니다 ${"x".repeat(2000)}`;
    const res = await POST(req(long));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, stored: false });
    expect(state.inserts).toHaveLength(0);
  });

  it("응답에 본문을 에코하지 않는다 — 개인 문자가 로그에 남으면 안 된다", async () => {
    const personal = "저녁에 치킨 시킬까 인증번호 말고 그냥";
    const res = await POST(req(personal));
    expect(await res.text()).not.toContain("치킨");
  });

  it("빈 본문은 400 — Tasker 설정이 잘못된 것이라 고쳐야 한다", async () => {
    expect((await POST(req(""))).status).toBe(400);
  });

  it("DB 오류는 500 — 폰 쪽 로그에 남게 한다", async () => {
    state.insertError = { message: "boom" };
    expect((await POST(req(MOA))).status).toBe(500);
  });
});
