import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendTeamsMock, adminFrom, listContractsMock, insertBriefingMock } =
  vi.hoisted(() => ({
    sendTeamsMock: vi.fn(
      async (_args: {
        operatorEmail: string;
        chatId: string;
        html: string;
      }) => ({ id: "m1" }),
    ),
    adminFrom: vi.fn(),
    insertBriefingMock: vi.fn(async (_row: unknown) => ({ error: null })),
    listContractsMock: vi.fn(async () => ({
      rows: [] as { sheet: string; status: string; serviceActive: string }[],
      total: 0,
    })),
  }));

vi.mock("@/lib/microsoft/teams", () => ({
  sendTeamsChatMessage: sendTeamsMock,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminFrom }),
}));
vi.mock("@/features/contracts/queries", () => ({
  listContracts: listContractsMock,
}));

import { runTeamBriefing } from "../team-briefing";

type Chain = {
  select: () => Chain;
  not: () => Chain;
  gte: () => Chain;
  lte: () => Chain;
  order: () => Promise<{ data: unknown[]; error: unknown }>;
};
function chain(data: unknown[]): Chain {
  const c: Chain = {
    select: () => c,
    not: () => c,
    gte: () => c,
    lte: () => c,
    order: () => Promise.resolve({ data, error: null }),
  };
  return c;
}

beforeEach(() => {
  vi.clearAllMocks();
  listContractsMock.mockResolvedValue({
    rows: [
      { sheet: "4년제", status: "계약완료", serviceActive: "Y" },
      { sheet: "4년제", status: "", serviceActive: "Y" },
      // 서비스여부 N → 집계 제외
      { sheet: "4년제", status: "계약완료", serviceActive: "N" },
    ],
    total: 3,
  });
  adminFrom.mockImplementation((table: string) => {
    if (table === "team_briefings")
      return {
        // 호수 count 조회 — select가 곧바로 await됨
        select: () => Promise.resolve({ count: 0, error: null }),
        insert: insertBriefingMock,
      };
    if (table === "schedule_events") return chain([]);
    if (table === "closing_services")
      return chain([
        {
          university_name: "건국대",
          service_name: "수시",
          pay_end_at: "2026-07-05T07:00:00+09:00",
          operator_name: "송영신",
        },
      ]);
    if (table === "operators")
      return chain([{ email: "kim@x.com", name: "김유민" }]);
    if (table === "ai_work")
      return chain([
        {
          title: "계약서 검토 자동화",
          ai_tool: "claude",
          author_email: "kim@x.com",
          saved_hours: 3,
        },
        {
          title: "주간보고 초안",
          ai_tool: "chatgpt",
          author_email: "lee@x.com", // operators에 없음 → email 앞부분 폴백
          saved_hours: null,
        },
      ]);
    if (table === "ai_tips")
      return chain([
        { title: "요약 자동화 팁", ai_tool: "claude", author_email: "kim@x.com" },
      ]);
    if (table === "insight_videos")
      return chain([
        {
          title: "Claude Code 실전",
          channel_title: "바이브랩스",
          view_count: 123456,
          video_id: "abc123",
        },
      ]);
    return chain([]);
  });
  vi.stubEnv("TEAMS_NOTICE_CHAT_ID", "chat-1"); // 방 소스(공지 방)
  vi.stubEnv("TEAMS_CHAT_ID", ""); // 차주보고 방 — 브리핑 미사용
  vi.stubEnv("TEAMS_BRIEFING_SENDER", "ops@x.com");
  vi.stubEnv("TEAMS_NOTICE_SENDER", "");
  vi.stubEnv("TEAM_BRIEFING_DRY_RUN", "");
  vi.stubEnv("MAIL_DRY_RUN", "");
});

describe("runTeamBriefing", () => {
  it("공지 방(TEAMS_NOTICE_CHAT_ID) 미설정이면 발송 생략(로그만) — 차주보고 방 폴백 안 함", async () => {
    vi.stubEnv("TEAMS_NOTICE_CHAT_ID", "");
    vi.stubEnv("TEAMS_CHAT_ID", "chat-1"); // 있어도 폴백 X
    const r = await runTeamBriefing();
    expect(r.ok).toBe(true);
    expect(r.message).toContain("미설정");
    expect(sendTeamsMock).not.toHaveBeenCalled();
  });

  it("DRY-RUN 시 발송하지 않고 집계 결과만 반환", async () => {
    vi.stubEnv("MAIL_DRY_RUN", "true");
    const r = await runTeamBriefing();
    expect(r.ok).toBe(true);
    expect(r.message).toContain("DRY-RUN");
    expect(r.details?.closing).toBe(1);
    // 서비스여부 'Y' 2건만 집계(N 1건 제외) → 완료 1·진행중 1
    expect(r.details?.contractsDone).toBe(1);
    expect(r.details?.contractsOngoing).toBe(1);
    expect(sendTeamsMock).not.toHaveBeenCalled();
  });

  it("정상 시 Teams 티저 발송 — 발신자/채팅방/제호·수치·뉴스레터 링크", async () => {
    const r = await runTeamBriefing();
    expect(r.ok).toBe(true);
    expect(sendTeamsMock).toHaveBeenCalledTimes(1);
    const arg = sendTeamsMock.mock.calls[0][0];
    expect(arg.operatorEmail).toBe("ops@x.com");
    expect(arg.chatId).toBe("chat-1");
    expect(arg.html).toContain("[운영부 주간 브리핑] #1");
    expect(arg.html).toContain("마감 임박 1건");
    expect(arg.html).toContain("/r/briefing/");
    expect(arg.html).toContain("뉴스레터 전체 보기");
  });

  it("뉴스레터 발행 — team_briefings에 payload·share_token insert", async () => {
    const r = await runTeamBriefing();
    expect(r.ok).toBe(true);
    expect(insertBriefingMock).toHaveBeenCalledTimes(1);
    const row = insertBriefingMock.mock.calls[0][0] as {
      issue_no: number;
      payload: {
        aiWork: { items: { author_name: string }[] };
        closing: unknown[];
      };
      share_token: string;
    };
    expect(row.issue_no).toBe(1);
    expect(row.share_token).toMatch(/^[0-9a-f]{32}$/);
    expect(row.payload.closing).toHaveLength(1);
    // 작성자 이름 매핑 — operators 등록자는 이름, 미등록은 email 앞부분
    expect(row.payload.aiWork.items.map((i) => i.author_name)).toEqual([
      "김유민",
      "lee",
    ]);
    // 티저 링크가 발행 토큰을 가리킴
    expect(sendTeamsMock.mock.calls[0][0].html).toContain(row.share_token);
  });

  it("수신 방은 공지 방(TEAMS_NOTICE_CHAT_ID)만 사용 (차주보고 방 무시)", async () => {
    vi.stubEnv("TEAMS_NOTICE_CHAT_ID", "19:notice-room@thread.v2");
    vi.stubEnv("TEAMS_CHAT_ID", "chat-1"); // 무시됨
    const r = await runTeamBriefing();
    expect(r.ok).toBe(true);
    expect(sendTeamsMock).toHaveBeenCalledTimes(1);
    expect(sendTeamsMock.mock.calls[0][0].chatId).toBe(
      "19:notice-room@thread.v2",
    );
  });

  it("AI 활용 집계 — details 수치 + 티저에 작업·TIP 카운트", async () => {
    const r = await runTeamBriefing();
    expect(r.ok).toBe(true);
    const html = sendTeamsMock.mock.calls[0][0].html;
    expect(html).toContain("AI 작업 2건(절감 3h)");
    expect(html).toContain("신규 TIP 1건");
    expect(r.details?.aiWorkCount).toBe(2);
    expect(r.details?.aiWorkSavedHours).toBe(3);
    expect(r.details?.tipsNew).toBe(1);
    expect(r.details?.insightsNew).toBe(1);
  });

  it("발신자 env 모두 미설정이면 기본값(ys1114)으로 발송", async () => {
    vi.stubEnv("TEAMS_BRIEFING_SENDER", "");
    vi.stubEnv("TEAMS_NOTICE_SENDER", "");
    const r = await runTeamBriefing();
    expect(r.ok).toBe(true);
    expect(sendTeamsMock).toHaveBeenCalledTimes(1);
    expect(sendTeamsMock.mock.calls[0][0].operatorEmail).toBe(
      "ys1114@jinhakapply.com",
    );
  });
});
