import { describe, it, expect, vi, beforeEach } from "vitest";

const { buildMock, publishMock, mockCreateAdminClient } = vi.hoisted(() => ({
  buildMock: vi.fn(),
  publishMock: vi.fn(),
  mockCreateAdminClient: vi.fn(),
}));

vi.mock("@/features/automations/jobs/team-briefing", () => ({
  buildBriefingData: buildMock,
  publishBriefing: publishMock,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

import { GET } from "../draft/route";
import { POST } from "../publish/route";

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
    buildMock.mockResolvedValue({
      ok: true,
      payload: samplePayload,
      details: {},
    });
    mockCreateAdminClient.mockReturnValue({
      from: () => ({
        select: () => Promise.resolve({ count: 4, error: null }),
      }),
    });
  });

  it("secret 없으면 401", async () => {
    expect((await GET(get())).status).toBe(401);
  });

  it("정상 — payload + nextIssueNo(count+1) 반환", async () => {
    const res = await GET(get("s3cr3t"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.payload.dateLabel).toBe("2026-07-17 (금)");
    expect(json.nextIssueNo).toBe(5);
  });

  it("집계 실패 → 500", async () => {
    buildMock.mockResolvedValue({ ok: false, message: "조회 실패" });
    expect((await GET(get("s3cr3t"))).status).toBe(500);
  });
});

describe("/api/team-briefing/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    publishMock.mockResolvedValue({
      ok: true,
      issueNo: 5,
      url: "https://x/r/briefing/tok",
      sent: true,
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

  it("정상 — publishBriefing에 payload 전달, issueNo/url/sent 반환", async () => {
    const res = await POST(
      post({ secret: "s3cr3t", body: { payload: samplePayload } }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.issueNo).toBe(5);
    expect(json.sent).toBe(true);
    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({ dateLabel: "2026-07-17 (금)" }),
    );
  });

  it("발행 실패 → 500", async () => {
    publishMock.mockResolvedValue({ ok: false, message: "insert 실패" });
    expect(
      (await POST(post({ secret: "s3cr3t", body: { payload: samplePayload } })))
        .status,
    ).toBe(500);
  });
});
