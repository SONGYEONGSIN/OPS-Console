import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  sendTeamsMock,
  adminFrom,
  listContractsMock,
  insertBriefingMock,
  deleteDraftMock,
  updateBriefingMock,
} = vi.hoisted(() => ({
  sendTeamsMock: vi.fn(
    async (_args: { operatorEmail: string; chatId: string; html: string }) => ({
      id: "m1",
    }),
  ),
  adminFrom: vi.fn(),
  insertBriefingMock: vi.fn(async (_row: unknown) => ({ error: null })),
  deleteDraftMock: vi.fn(async () => ({ error: null })),
  updateBriefingMock: vi.fn((_row: unknown) => ({
    eq: vi.fn(async () => ({ error: null })),
  })),
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

import {
  runTeamBriefing,
  stageBriefingDraft,
  publishStagedDraft,
} from "../team-briefing";
import type { BriefingPayload } from "../team-briefing-build";

type ChainResult = { data: unknown[]; count: number; error: null };
type Chain = {
  select: () => Chain;
  not: () => Chain;
  gte: () => Chain;
  lte: () => Chain;
  order: () => Chain;
  limit: () => Chain;
  then: (resolve: (v: ChainResult) => void) => void;
};
// 완전 체이너블 + thenable — 어느 체인 뒤에 await/limit이 와도 동작.
function chain(data: unknown[]): Chain {
  const result: ChainResult = { data, count: data.length, error: null };
  const c: Chain = {
    select: () => c,
    not: () => c,
    gte: () => c,
    lte: () => c,
    order: () => c,
    limit: () => c,
    then: (resolve) => resolve(result),
  };
  return c;
}

/**
 * team_briefings 테이블 목 — 한 체인이 두 용도로 쓰인다.
 * `.select(...).eq(...)` 는 호수 count로 await 되기도 하고(thenable),
 * `.maybeSingle()` 로 초안 1건을 꺼내기도 한다.
 */
const briefingsState = { publishedCount: 0, draft: null as unknown };
function briefingsTable() {
  const eqResult = {
    then: (resolve: (v: unknown) => void) =>
      resolve({ count: briefingsState.publishedCount, error: null }),
    maybeSingle: () =>
      Promise.resolve({ data: briefingsState.draft, error: null }),
  };
  return {
    select: () => ({ eq: () => eqResult }),
    delete: () => ({ eq: deleteDraftMock }),
    insert: insertBriefingMock,
    update: updateBriefingMock,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  briefingsState.publishedCount = 0;
  briefingsState.draft = null;
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
    if (table === "team_briefings") return briefingsTable();
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
        {
          title: "요약 자동화 팁",
          ai_tool: "claude",
          author_email: "kim@x.com",
        },
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

function samplePayload(): BriefingPayload {
  return {
    dateLabel: "2026-07-31 (금)",
    contracts: { bySheet: [], totalDone: 0, totalOngoing: 0 },
    weekRange: { startYmd: "2026-08-03", endYmd: "2026-08-07" },
    schedule: [],
    closing: [],
    aiWork: { count: 0, totalCount: 0, savedHours: 0, items: [], more: 0 },
    tips: { newCount: 0, totalCount: 0, items: [], more: 0 },
    insights: { newCount: 0, items: [] },
  };
}

describe("stageBriefingDraft", () => {
  it("기존 초안을 지우고 status=draft로 저장한다", async () => {
    const r = await stageBriefingDraft(samplePayload());
    expect(r.ok).toBe(true);
    expect(deleteDraftMock).toHaveBeenCalledWith("status", "draft");
    const row = insertBriefingMock.mock.calls[0][0] as { status: string };
    expect(row.status).toBe("draft");
  });

  it("호수는 published 행만 세어 매긴다", async () => {
    briefingsState.publishedCount = 3;
    const r = await stageBriefingDraft(samplePayload());
    expect(r.ok && r.nextIssueNo).toBe(4);
  });

  it("그룹채팅 티저를 보내지 않는다", async () => {
    vi.stubEnv("TEAMS_BRIEFING_DRAFT_CHAT_ID", "");
    await stageBriefingDraft(samplePayload());
    expect(sendTeamsMock).not.toHaveBeenCalled();
  });

  it("초안 알림 방이 설정되면 본인 채팅으로 미리보기 링크를 보낸다", async () => {
    vi.stubEnv("TEAMS_BRIEFING_DRAFT_CHAT_ID", "19:me@thread.v2");
    const r = await stageBriefingDraft(samplePayload());
    expect(r.ok && r.notified).toBe(true);
    expect(sendTeamsMock).toHaveBeenCalledTimes(1);
    const arg = sendTeamsMock.mock.calls[0][0];
    expect(arg.chatId).toBe("19:me@thread.v2");
    expect(arg.html).toContain("/r/briefing/");
    expect(arg.html).toContain("초안");
  });

  it("알림 실패해도 초안은 유지 (notified:false)", async () => {
    vi.stubEnv("TEAMS_BRIEFING_DRAFT_CHAT_ID", "19:me@thread.v2");
    sendTeamsMock.mockRejectedValueOnce(new Error("graph 403"));
    const r = await stageBriefingDraft(samplePayload());
    expect(r.ok).toBe(true);
    expect(r.ok && r.notified).toBe(false);
  });
});

describe("publishStagedDraft", () => {
  beforeEach(() => {
    briefingsState.draft = {
      id: "d1",
      issue_no: 2,
      share_token: "tok2",
      payload: samplePayload(),
    };
    briefingsState.publishedCount = 1;
  });

  it("status/published_at을 갱신하고 토큰은 유지하며 그룹 티저를 보낸다", async () => {
    const r = await publishStagedDraft("d1");
    expect(r.ok).toBe(true);
    expect(r.ok && r.issueNo).toBe(2);
    expect(r.ok && r.url).toContain("/r/briefing/tok2");
    const row = updateBriefingMock.mock.calls[0][0] as {
      status: string;
      published_at: string;
    };
    expect(row.status).toBe("published");
    expect(row.published_at).toBeTruthy();
    expect(sendTeamsMock).toHaveBeenCalledTimes(1);
    expect(sendTeamsMock.mock.calls[0][0].chatId).toBe("chat-1");
    expect(sendTeamsMock.mock.calls[0][0].html).toContain("tok2");
  });

  it("초안이 없으면 ok:false", async () => {
    briefingsState.draft = null;
    const r = await publishStagedDraft("missing");
    expect(r.ok).toBe(false);
  });

  it("그룹 방 미설정이면 발행만 하고 발송 생략", async () => {
    vi.stubEnv("TEAMS_NOTICE_CHAT_ID", "");
    const r = await publishStagedDraft("d1");
    expect(r.ok && r.sent).toBe(false);
    expect(sendTeamsMock).not.toHaveBeenCalled();
  });
});

describe("runTeamBriefing (초안 생성)", () => {
  it("DRY-RUN 시 저장하지 않고 집계 결과만 반환", async () => {
    vi.stubEnv("MAIL_DRY_RUN", "true");
    const r = await runTeamBriefing();
    expect(r.ok).toBe(true);
    expect(r.message).toContain("DRY-RUN");
    expect(r.details?.closing).toBe(1);
    // 서비스여부 'Y' 2건만 집계(N 1건 제외) → 완료 1·진행중 1
    expect(r.details?.contractsDone).toBe(1);
    expect(r.details?.contractsOngoing).toBe(1);
    expect(insertBriefingMock).not.toHaveBeenCalled();
    expect(sendTeamsMock).not.toHaveBeenCalled();
  });

  it("정상 실행은 초안만 만들고 그룹채팅에 발송하지 않는다", async () => {
    vi.stubEnv("TEAMS_BRIEFING_DRAFT_CHAT_ID", "");
    const r = await runTeamBriefing();
    expect(r.ok).toBe(true);
    expect(r.message).toContain("초안");
    expect(r.message).toContain("발행 대기");
    expect(insertBriefingMock).toHaveBeenCalledTimes(1);
    expect(sendTeamsMock).not.toHaveBeenCalled();
  });

  it("그룹 방 미설정이어도 초안은 생성된다", async () => {
    vi.stubEnv("TEAMS_NOTICE_CHAT_ID", "");
    const r = await runTeamBriefing();
    expect(r.ok).toBe(true);
    expect(insertBriefingMock).toHaveBeenCalledTimes(1);
  });

  it("초안 payload — 작성자 이름 매핑 + 마감 목록", async () => {
    const r = await runTeamBriefing();
    expect(r.ok).toBe(true);
    const row = insertBriefingMock.mock.calls[0][0] as {
      issue_no: number;
      status: string;
      share_token: string;
      payload: {
        aiWork: { items: { author_name: string }[] };
        closing: unknown[];
      };
    };
    expect(row.issue_no).toBe(1);
    expect(row.status).toBe("draft");
    expect(row.share_token).toMatch(/^[0-9a-f]{32}$/);
    expect(row.payload.closing).toHaveLength(1);
    // 작성자 이름 매핑 — operators 등록자는 이름, 미등록은 email 앞부분
    expect(row.payload.aiWork.items.map((i) => i.author_name)).toEqual([
      "김유민",
      "lee",
    ]);
  });

  it("AI 활용 집계 — details 수치", async () => {
    const r = await runTeamBriefing();
    expect(r.ok).toBe(true);
    expect(r.details?.aiWorkCount).toBe(2);
    expect(r.details?.aiWorkSavedHours).toBe(3);
    expect(r.details?.tipsNew).toBe(1);
    expect(r.details?.insightsNew).toBe(1);
  });

  it("초안 알림 발신자 env 모두 미설정이면 기본값(ys1114)", async () => {
    vi.stubEnv("TEAMS_BRIEFING_DRAFT_CHAT_ID", "19:me@thread.v2");
    vi.stubEnv("TEAMS_BRIEFING_SENDER", "");
    vi.stubEnv("TEAMS_NOTICE_SENDER", "");
    const r = await runTeamBriefing();
    expect(r.ok).toBe(true);
    expect(sendTeamsMock.mock.calls[0][0].operatorEmail).toBe(
      "ys1114@jinhakapply.com",
    );
  });
});
