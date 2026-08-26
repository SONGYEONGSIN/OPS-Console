import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Teams 채팅방의 질문을 웹과 **같은 큐**에 넣는다.
 *
 * 15초 안에 답할 수 없으므로(우리 답은 6~40초) 여기서는 **적재까지만** 하고
 * "찾아보는 중"을 올린다. 답은 `/api/teams/flush` 가 그 메시지를 고쳐 쓴다.
 */
const verify = vi.fn();
const resolveEmail = vi.fn();
const post = vi.fn();
const insert = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@/features/teams-bot/verify-token", () => ({ verifyBotToken: verify }));
vi.mock("@/features/teams-bot/resolve-email", () => ({ emailFromAadObjectId: resolveEmail }));
vi.mock("@/lib/microsoft/bot-framework", () => ({ postActivity: post, updateActivity: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      insert: () => ({ select: () => ({ single: insert }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  }),
}));

const ACTIVITY = {
  type: "message",
  serviceUrl: "https://smba.trafficmanager.net/kr/",
  from: { id: "29:a", name: "송영신", aadObjectId: "aad-1" },
  conversation: { id: "19:x", conversationType: "groupChat" },
  text: "<at>명보</at> 질문",
  entities: [{ type: "mention", text: "<at>명보</at>", mentioned: { id: "28:bot" } }],
};

function req(body: unknown) {
  return new Request("https://x.test/api/teams/messages", {
    method: "POST",
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetModules();
  [verify, resolveEmail, post, insert, maybeSingle].forEach((m) => m.mockReset());
  vi.stubEnv("TEAMS_BOT_APP_ID", "28:bot");
  verify.mockResolvedValue({ ok: true });
  resolveEmail.mockResolvedValue("a@x.com");
  maybeSingle.mockResolvedValue({ data: { email: "a@x.com" } });
  post.mockResolvedValue("act-1");
  insert.mockResolvedValue({ data: { id: "req-1" }, error: null });
});

describe("POST /api/teams/messages", () => {
  it("검증에 실패하면 401 — 주소가 공개돼 있어 이게 유일한 관문이다", async () => {
    verify.mockResolvedValue({ ok: false, reason: "bad" });
    const { POST } = await import("../route");
    expect((await POST(req(ACTIVITY) as never)).status).toBe(401);
  });

  it("명부 밖 사람이면 적재하지 않는다", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    const { POST } = await import("../route");
    await POST(req(ACTIVITY) as never);
    expect(insert).not.toHaveBeenCalled();
  });

  it("명부 밖이어도 채팅에는 알린다 — 조용히 무시하면 봇이 죽은 줄 안다", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    const { POST } = await import("../route");
    await POST(req(ACTIVITY) as never);
    expect(String(post.mock.calls[0]?.[0]?.text)).toMatch(/운영부|명부|권한/);
  });

  it("나를 안 불렀으면 아무것도 하지 않는다 — 채팅방 모든 말에 답하지 않는다", async () => {
    const { POST } = await import("../route");
    await POST(req({ ...ACTIVITY, text: "그냥 잡담", entities: [] }) as never);
    expect(post).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("정상이면 적재하고 '찾아보는 중'을 올린다", async () => {
    const { POST } = await import("../route");
    const res = await POST(req(ACTIVITY) as never);
    expect(res.status).toBe(200);
    expect(post).toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
  });

  it("무엇이 잘못돼도 200 으로 답한다 — Teams 가 재시도로 같은 질문을 또 넣는다", async () => {
    insert.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { POST } = await import("../route");
    expect((await POST(req(ACTIVITY) as never)).status).toBe(200);
  });
});
