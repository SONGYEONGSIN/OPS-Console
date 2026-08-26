import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 답이 준비된 건을 Teams 로 되돌려 준다.
 *
 * 회사 PC 폴러가 직접 Teams 로 보내지 않는다 — 폴러는 볼트를 읽는 일만 하고,
 * **채팅 발송 자격증명을 그 PC 에 늘리지 않는다.**
 */
const update = vi.fn();
const post = vi.fn();
const rows = vi.fn();
const markReplied = vi.fn();

vi.mock("@/lib/microsoft/bot-framework", () => ({ updateActivity: update, postActivity: post }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ not: () => ({ is: () => ({ order: () => ({ limit: rows }) }) }) }),
      update: () => ({ eq: markReplied }),
    }),
  }),
}));

function req(secret = "s3cret") {
  return new Request("https://x.test/api/teams/flush", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
}

const ROW = {
  id: "r1",
  status: "done",
  answer: "답",
  message: null,
  requested_at: new Date().toISOString(),
  teams_conversation_id: "19:x",
  teams_service_url: "https://smba.trafficmanager.net/kr/",
  teams_activity_id: "act-1",
};

beforeEach(() => {
  vi.resetModules();
  [update, post, rows, markReplied].forEach((m) => m.mockReset());
  vi.stubEnv("CRON_SECRET", "s3cret");
  rows.mockResolvedValue({ data: [ROW], error: null });
  update.mockResolvedValue(true);
  post.mockResolvedValue("act-2");
  markReplied.mockResolvedValue({ error: null });
});

describe("POST /api/teams/flush", () => {
  it("비밀키가 없으면 401", async () => {
    const { POST } = await import("../route");
    expect((await POST(req("wrong-key") as never)).status).toBe(401);
  });

  it("올려둔 메시지를 고쳐 쓴다 — 새 줄을 쌓지 않는다", async () => {
    const { POST } = await import("../route");
    await POST(req() as never);
    expect(update).toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("보낸 건은 표시한다 — 안 하면 매분 같은 답을 다시 쓴다", async () => {
    const { POST } = await import("../route");
    await POST(req() as never);
    expect(markReplied).toHaveBeenCalled();
  });

  it("고쳐 쓰기가 막히면 새 메시지로 물러선다 — 답이 사라지는 것보다 낫다", async () => {
    update.mockResolvedValue(false);
    const { POST } = await import("../route");
    await POST(req() as never);
    expect(post).toHaveBeenCalled();
    expect(markReplied).toHaveBeenCalled();
  });

  it("아직 도는 중이면 건드리지 않는다", async () => {
    rows.mockResolvedValue({ data: [{ ...ROW, status: "running", answer: null }], error: null });
    const { POST } = await import("../route");
    await POST(req() as never);
    expect(update).not.toHaveBeenCalled();
    expect(markReplied).not.toHaveBeenCalled();
  });

  it("둘 다 실패하면 표시하지 않는다 — 다음 차례에 다시 시도한다", async () => {
    update.mockResolvedValue(false);
    post.mockResolvedValue(null);
    const { POST } = await import("../route");
    await POST(req() as never);
    expect(markReplied).not.toHaveBeenCalled();
  });
});
