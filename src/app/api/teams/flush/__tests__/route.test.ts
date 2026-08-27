import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 답이 준비된 건을 **그 방에 올린다**.
 *
 * 회사 PC 폴러가 직접 Teams 로 보내지 않는다 — 폴러는 볼트를 읽는 일만 하고,
 * 채팅 발송 자격증명을 그 PC 에 늘리지 않는다.
 *
 * 봇 등록이 끝내 동작하지 않아 Graph 로 왔다(2026-08-27). 고쳐 쓸 자리가 없으므로
 * **답이 준비됐을 때 한 번만** 쓴다.
 */
const send = vi.fn();
const rows = vi.fn();
const markReplied = vi.fn();

vi.mock("@/lib/microsoft/teams", () => ({ sendTeamsChatMessage: send }));
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
  operator_email: "a@x.com",
};

beforeEach(() => {
  vi.resetModules();
  [send, rows, markReplied].forEach((m) => m.mockReset());
  vi.stubEnv("CRON_SECRET", "s3cret");
  vi.stubEnv("TEAMS_POLL_OPERATOR_EMAIL", "reader@x.com");
  rows.mockResolvedValue({ data: [ROW], error: null });
  send.mockResolvedValue({ id: "m1" });
  markReplied.mockResolvedValue({ error: null });
});

describe("POST /api/teams/flush", () => {
  it("비밀키가 없으면 401", async () => {
    const { POST } = await import("../route");
    expect((await POST(req("wrong-key") as never)).status).toBe(401);
  });

  it("그 방에 답을 올린다", async () => {
    const { POST } = await import("../route");
    await POST(req() as never);
    expect(send).toHaveBeenCalled();
    expect(send.mock.calls[0][0].chatId).toBe("19:x");
  });

  it("읽어준 사람 자격으로 쓴다 — 물어본 사람이 아니다", async () => {
    const { POST } = await import("../route");
    await POST(req() as never);
    expect(send.mock.calls[0][0].operatorEmail).toBe("reader@x.com");
  });

  it("보낸 건은 표시한다 — 안 하면 매분 같은 답을 다시 쓴다", async () => {
    const { POST } = await import("../route");
    await POST(req() as never);
    expect(markReplied).toHaveBeenCalled();
  });

  it("발송이 실패하면 표시하지 않는다 — 다음 차례에 다시 시도한다", async () => {
    send.mockRejectedValue(new Error("graph 500"));
    const { POST } = await import("../route");
    await POST(req() as never);
    expect(markReplied).not.toHaveBeenCalled();
  });

  it("아직 도는 중이면 건드리지 않는다", async () => {
    rows.mockResolvedValue({ data: [{ ...ROW, status: "running", answer: null }], error: null });
    const { POST } = await import("../route");
    await POST(req() as never);
    expect(send).not.toHaveBeenCalled();
    expect(markReplied).not.toHaveBeenCalled();
  });

  it("답에 든 꺾쇠는 마크업으로 새지 않는다", async () => {
    rows.mockResolvedValue({ data: [{ ...ROW, answer: "<b>굵게</b> 아님" }], error: null });
    const { POST } = await import("../route");
    await POST(req() as never);
    expect(send.mock.calls[0][0].html).toContain("&lt;b&gt;");
  });

  it("줄바꿈을 살린다 — 한 덩이로 붙으면 못 읽는다", async () => {
    rows.mockResolvedValue({ data: [{ ...ROW, answer: "첫 줄\n둘째 줄" }], error: null });
    const { POST } = await import("../route");
    await POST(req() as never);
    expect(send.mock.calls[0][0].html).toContain("<br>");
  });
});
