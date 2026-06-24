import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendTeamsMock, adminFrom, updateEq } = vi.hoisted(() => ({
  sendTeamsMock: vi.fn(
    async (_args: { operatorEmail: string; chatId: string; html: string }) => ({
      id: "msg1",
    }),
  ),
  adminFrom: vi.fn(),
  updateEq: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/lib/microsoft/teams", () => ({
  sendTeamsChatMessage: sendTeamsMock,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminFrom }),
}));

import { runNoticeTeamsShare, buildNoticeMessage } from "../notice-teams-share";

// posts.select(...).eq("domain","notice").is("notice_shared_at",null).order().limit()
function wireSelect(rows: Array<Record<string, unknown>>) {
  const limit = vi.fn(async () => ({ data: rows, error: null }));
  const order = vi.fn(() => ({ limit }));
  const is = vi.fn(() => ({ order }));
  const eq = vi.fn(() => ({ is }));
  const select = vi.fn(() => ({ eq }));
  const update = vi.fn(() => ({ eq: updateEq }));
  adminFrom.mockReturnValue({ select, update });
}

beforeEach(() => {
  vi.clearAllMocks();
  sendTeamsMock.mockResolvedValue({ id: "msg1" });
  updateEq.mockResolvedValue({ error: null });
  vi.stubEnv("TEAMS_NOTICE_CHAT_ID", "chat-1");
  vi.stubEnv("TEAMS_NOTICE_SENDER", "ops@x.com");
  vi.stubEnv("TEAMS_CHAT_ID", "");
});

describe("buildNoticeMessage", () => {
  it("제목/본문을 담고 [공지] 머리말 + 줄바꿈→<br/>", () => {
    const html = buildNoticeMessage({
      title: "점검 안내",
      body: "첫 줄\n둘째 줄",
    });
    expect(html).toContain("[공지]");
    expect(html).toContain("점검 안내");
    expect(html).toContain("첫 줄<br/>둘째 줄");
  });
  it("HTML 특수문자를 이스케이프한다", () => {
    const html = buildNoticeMessage({ title: "<b>x</b> & y", body: null });
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt; &amp; y");
  });
});

describe("runNoticeTeamsShare", () => {
  it("미공유 공지를 Teams로 보내고 notice_shared_at을 기록한다", async () => {
    wireSelect([
      { id: "n1", title: "점검 안내", body: "내용", owner_label: "운영부" },
    ]);
    const r = await runNoticeTeamsShare();
    expect(r.ok).toBe(true);
    expect(sendTeamsMock).toHaveBeenCalledTimes(1);
    expect(sendTeamsMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({ operatorEmail: "ops@x.com", chatId: "chat-1" }),
    );
    expect(updateEq).toHaveBeenCalledTimes(1); // notice_shared_at 표시
    expect(r.details?.shared).toBe(1);
  });

  it("미공유 공지 없으면 발송 없이 0건", async () => {
    wireSelect([]);
    const r = await runNoticeTeamsShare();
    expect(r.ok).toBe(true);
    expect(sendTeamsMock).not.toHaveBeenCalled();
    expect(r.details?.shared ?? 0).toBe(0);
  });

  it("채팅방 미설정(둘 다 빈값)이면 전송 생략", async () => {
    vi.stubEnv("TEAMS_NOTICE_CHAT_ID", "");
    vi.stubEnv("TEAMS_CHAT_ID", "");
    const r = await runNoticeTeamsShare();
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/채팅방|미설정/);
    expect(sendTeamsMock).not.toHaveBeenCalled();
  });

  it("발신자 미설정이면 전송 생략", async () => {
    vi.stubEnv("TEAMS_NOTICE_SENDER", "");
    const r = await runNoticeTeamsShare();
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/발신자|미설정/);
    expect(sendTeamsMock).not.toHaveBeenCalled();
  });
});
