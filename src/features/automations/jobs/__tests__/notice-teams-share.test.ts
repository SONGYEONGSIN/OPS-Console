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

// posts.select(...).eq("domain","notice").is("notice_shared_at",null).or(...).order().limit()
const orArg = { value: "" };
function wireSelect(rows: Array<Record<string, unknown>>) {
  orArg.value = "";
  const limit = vi.fn(async () => ({ data: rows, error: null }));
  const order = vi.fn(() => ({ limit }));
  const or = vi.fn((expr: string) => {
    orArg.value = expr;
    return { order };
  });
  const is = vi.fn(() => ({ or }));
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
  it("작성자 라인(— ...)을 넣지 않는다", () => {
    const html = buildNoticeMessage({ title: "안내", body: "본문" });
    expect(html).not.toContain("—");
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

  it("각 공지를 작성자(author_email) 명의로 발송한다 (ys1114/alcure23)", async () => {
    wireSelect([
      {
        id: "n1",
        title: "공지A",
        body: "b",
        owner_label: "운영부",
        author_email: "alcure23@jinhakapply.com",
      },
      {
        id: "n2",
        title: "공지B",
        body: "b",
        owner_label: "운영부",
        author_email: "ys1114@jinhakapply.com",
      },
    ]);
    await runNoticeTeamsShare();
    expect(sendTeamsMock).toHaveBeenCalledTimes(2);
    expect(sendTeamsMock.mock.calls[0][0].operatorEmail).toBe(
      "alcure23@jinhakapply.com",
    );
    expect(sendTeamsMock.mock.calls[1][0].operatorEmail).toBe(
      "ys1114@jinhakapply.com",
    );
  });

  // 공지일에 시간이 붙었다. 날짜만 보면 09:00 로 잡아둔 공지가 그날 00:00 첫 실행에
  // 나가버린다 — 잡이 30분 간격이라 시각 비교가 실제로 의미가 있다.
  it("공지 시각이 지금 이하 또는 null인 건만 조회한다", async () => {
    wireSelect([]);
    await runNoticeTeamsShare();
    expect(orArg.value).toContain("announce_at.is.null");
    expect(orArg.value).toMatch(/announce_at\.lte\.\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it("날짜가 아니라 시각으로 자른다 — 오늘 늦은 시각 예약은 아직 안 나간다", async () => {
    wireSelect([]);
    await runNoticeTeamsShare();
    // 'YYYY-MM-DD' 만 넘기면 그날 예약이 전부 즉시 대상이 된다.
    expect(orArg.value).not.toMatch(/announce_at\.lte\.\d{4}-\d{2}-\d{2}$/);
  });


  it("미공유 공지 없으면 발송 없이 0건", async () => {
    wireSelect([]);
    const r = await runNoticeTeamsShare();
    expect(r.ok).toBe(true);
    expect(sendTeamsMock).not.toHaveBeenCalled();
    expect(r.details?.shared ?? 0).toBe(0);
  });

  it("TEAMS_NOTICE_CHAT_ID 미설정이면 TEAMS_CHAT_ID(차주보고)로 폴백하지 않고 전송 생략", async () => {
    vi.stubEnv("TEAMS_NOTICE_CHAT_ID", "");
    vi.stubEnv("TEAMS_CHAT_ID", "19:chajubogo@thread.v2"); // 설정돼 있어도 폴백 X
    const r = await runNoticeTeamsShare();
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/채팅방|미설정/);
    expect(sendTeamsMock).not.toHaveBeenCalled();
  });

  it("발신자 env 미설정이면 기본값(ys1114)으로 발송", async () => {
    vi.stubEnv("TEAMS_NOTICE_SENDER", "");
    wireSelect([{ id: "n1", title: "t", body: "b", owner_label: "운영부" }]);
    const r = await runNoticeTeamsShare();
    expect(r.ok).toBe(true);
    expect(sendTeamsMock).toHaveBeenCalledTimes(1);
    expect(sendTeamsMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({ operatorEmail: "ys1114@jinhakapply.com" }),
    );
  });
});
