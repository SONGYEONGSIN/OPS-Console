import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  buildMock,
  stageMock,
  mockCreateAdminClient,
  getJobEnabledMock,
  recordRunMock,
  eqSpy,
} = vi.hoisted(() => ({
  buildMock: vi.fn(),
  stageMock: vi.fn(),
  mockCreateAdminClient: vi.fn(),
  getJobEnabledMock: vi.fn(),
  recordRunMock: vi.fn(),
  eqSpy: vi.fn(() => Promise.resolve({ count: 4, error: null })),
}));

vi.mock("@/features/automations/jobs/team-briefing", () => ({
  buildBriefingData: buildMock,
  stageBriefingDraft: stageMock,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));
vi.mock("@/features/automations/queries", () => ({
  getJobEnabled: getJobEnabledMock,
}));
vi.mock("@/features/automations/run-recorder", () => ({
  recordAutomationRun: recordRunMock,
}));

import { GET } from "../draft/route";
import { POST } from "../stage/route";

function get(secret?: string) {
  return new Request("http://localhost/api/team-briefing/draft", {
    method: "GET",
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  }) as unknown as Parameters<typeof GET>[0];
}
function post(opts: { secret?: string; body?: unknown }) {
  return new Request("http://localhost/api/team-briefing/publish", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.secret ? { authorization: `Bearer ${opts.secret}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }) as unknown as Parameters<typeof POST>[0];
}

const samplePayload = {
  dateLabel: "2026-07-17 (금)",
  contracts: { bySheet: [], totalDone: 1, totalOngoing: 0 },
};

describe("/api/team-briefing/draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    getJobEnabledMock.mockResolvedValue(true);
    buildMock.mockResolvedValue({
      ok: true,
      payload: samplePayload,
      details: {},
    });
    mockCreateAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({ eq: eqSpy }),
      }),
    });
  });

  it("secret 없으면 401", async () => {
    expect((await GET(get())).status).toBe(401);
  });

  it("정상 — payload + nextIssueNo(발행분+1) 반환", async () => {
    const res = await GET(get("s3cr3t"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.payload.dateLabel).toBe("2026-07-17 (금)");
    expect(json.nextIssueNo).toBe(5);
  });

  it("호수는 발행분만 세어 매긴다 — 대기 중인 초안이 호수를 밀지 않는다", async () => {
    await GET(get("s3cr3t"));
    expect(eqSpy).toHaveBeenCalledWith("status", "published");
  });

  it("집계 실패 → 500", async () => {
    buildMock.mockResolvedValue({ ok: false, message: "조회 실패" });
    expect((await GET(get("s3cr3t"))).status).toBe(500);
  });

  it("자동 실행 OFF면 집계하지 않고 skipped:true + 실행이력 skip 기록", async () => {
    getJobEnabledMock.mockResolvedValue(false);
    const res = await GET(get("s3cr3t"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.skipped).toBe(true);
    expect(buildMock).not.toHaveBeenCalled();
    expect(recordRunMock).toHaveBeenCalledWith(
      "team-briefing",
      expect.objectContaining({ skipped: true }),
    );
  });
});

describe("/api/team-briefing/stage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    getJobEnabledMock.mockResolvedValue(true);
    stageMock.mockResolvedValue({
      ok: true,
      url: "https://x/r/briefing/tok",
      nextIssueNo: 2,
      notified: true,
    });
  });

  it("secret 없으면 401", async () => {
    expect(
      (await POST(post({ body: { payload: samplePayload } }))).status,
    ).toBe(401);
  });

  it("payload 누락/형식 오류 → 400", async () => {
    expect((await POST(post({ secret: "s3cr3t", body: {} }))).status).toBe(400);
    expect(
      (await POST(post({ secret: "s3cr3t", body: { payload: { x: 1 } } })))
        .status,
    ).toBe(400);
  });

  it("정상 — stageBriefingDraft에 payload 전달, url/nextIssueNo 반환", async () => {
    const res = await POST(
      post({ secret: "s3cr3t", body: { payload: samplePayload } }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.nextIssueNo).toBe(2);
    expect(json.url).toBe("https://x/r/briefing/tok");
    expect(stageMock).toHaveBeenCalledWith(
      expect.objectContaining({ dateLabel: "2026-07-17 (금)" }),
    );
  });

  it("초안 저장 실패 → 500", async () => {
    stageMock.mockResolvedValue({ ok: false, message: "insert 실패" });
    expect(
      (await POST(post({ secret: "s3cr3t", body: { payload: samplePayload } })))
        .status,
    ).toBe(500);
  });

  it("자동 실행 OFF면 초안도 만들지 않고 skipped:true", async () => {
    getJobEnabledMock.mockResolvedValue(false);
    const res = await POST(
      post({ secret: "s3cr3t", body: { payload: samplePayload } }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.skipped).toBe(true);
    expect(stageMock).not.toHaveBeenCalled();
  });

  it("초안 생성 시 automation_runs에 '발행 대기' 기록", async () => {
    await POST(post({ secret: "s3cr3t", body: { payload: samplePayload } }));
    expect(recordRunMock).toHaveBeenCalledWith(
      "team-briefing",
      expect.objectContaining({
        ok: true,
        skipped: false,
        message: expect.stringContaining("발행 대기"),
      }),
    );
  });

  it("본인 Teams 알림 미설정이면 이력 메시지에 남긴다", async () => {
    stageMock.mockResolvedValue({
      ok: true,
      url: "https://x/r/briefing/tok",
      nextIssueNo: 2,
      notified: false,
    });
    await POST(post({ secret: "s3cr3t", body: { payload: samplePayload } }));
    expect(recordRunMock).toHaveBeenCalledWith(
      "team-briefing",
      expect.objectContaining({
        message: expect.stringContaining("알림 미설정"),
      }),
    );
  });

  it("초안 저장 실패도 실행 기록 (ok:false)", async () => {
    stageMock.mockResolvedValue({ ok: false, message: "insert 실패" });
    await POST(post({ secret: "s3cr3t", body: { payload: samplePayload } }));
    expect(recordRunMock).toHaveBeenCalledWith(
      "team-briefing",
      expect.objectContaining({ ok: false }),
    );
  });
});
