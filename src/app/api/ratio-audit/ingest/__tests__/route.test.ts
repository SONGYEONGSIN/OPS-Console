import { describe, it, expect, vi, beforeEach } from "vitest";

const insertResult = { data: { id: "run-1" }, error: null };
const h = vi.hoisted(() => ({
  single: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  sendTeamsChatMessage: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: h.from }),
}));
vi.mock("@/lib/microsoft/teams", () => ({
  sendTeamsChatMessage: h.sendTeamsChatMessage,
}));

function payload(overrides: Record<string, unknown> = {}) {
  return {
    scannedCount: 3,
    findings: [
      {
        serviceId: 1093020,
        universityName: "성신여자대학교",
        serviceName: "수시",
        operatorName: "김지영",
        items: [
          { type: "year", field: "top", found: "2025학년도", expect: "2026", quote: "인용" },
        ],
      },
    ],
    linkErrors: [],
    skipped: [],
    ...overrides,
  };
}

function postReq(body: unknown, auth = "Bearer s3cret"): Request {
  return new Request("http://localhost/api/ratio-audit/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: auth },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ratio-audit/ingest", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const fn of Object.values(h)) fn.mockReset();
    process.env.CRON_SECRET = "s3cret";
    process.env.TEAMS_RATIO_AUDIT_CHAT_ID = "chat-1";
    h.single.mockResolvedValue(insertResult);
    h.select.mockReturnValue({ single: h.single });
    h.insert.mockReturnValue({ select: h.select });
    h.eq.mockResolvedValue({ error: null });
    h.update.mockReturnValue({ eq: h.eq });
    h.from.mockReturnValue({ insert: h.insert, update: h.update });
    h.sendTeamsChatMessage.mockResolvedValue({ id: "msg-1" });
  });

  it("secret 불일치면 401", async () => {
    const { POST } = await import("../route");
    const res = await POST(postReq(payload(), "Bearer wrong"));
    expect(res.status).toBe(401);
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("계약 위반 payload는 400", async () => {
    const { POST } = await import("../route");
    const res = await POST(postReq({ scannedCount: -1 }));
    expect(res.status).toBe(400);
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("적재 시 집계값과 payload를 함께 넣는다", async () => {
    const { POST } = await import("../route");
    const res = await POST(postReq(payload()));
    expect(res.status).toBe(200);
    const row = h.insert.mock.calls[0][0];
    expect(row.scanned_count).toBe(3);
    expect(row.finding_count).toBe(1);
    expect(row.link_error_count).toBe(0);
    expect(row.status).toBe("ok");
    expect(row.payload.findings).toHaveLength(1);
  });

  it("건너뛴 건이 있으면 status=partial", async () => {
    const { POST } = await import("../route");
    await POST(postReq(payload({ skipped: [{ serviceId: 9, reason: "진입 실패" }] })));
    expect(h.insert.mock.calls[0][0].status).toBe("partial");
  });

  it("Teams로 요약을 보내고 notified=true 로 갱신", async () => {
    const { POST } = await import("../route");
    const res = await POST(postReq(payload()));
    expect(h.sendTeamsChatMessage).toHaveBeenCalledTimes(1);
    expect(h.sendTeamsChatMessage.mock.calls[0][0].chatId).toBe("chat-1");
    expect(h.update).toHaveBeenCalledWith({ notified: true });
    const json = await res.json();
    expect(json.notified).toBe(true);
    expect(json.notifyError).toBeUndefined();
  });

  it("Teams 발송이 실패해도 적재는 유지하고 notified=false", async () => {
    h.sendTeamsChatMessage.mockRejectedValue(new Error("graph 500"));
    const { POST } = await import("../route");
    const res = await POST(postReq(payload()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.notified).toBe(false);
    expect(h.update).not.toHaveBeenCalled();
    expect(json.notifyError).toBe("graph 500");
  });

  it("채팅방 미설정이면 발송을 건너뛴다", async () => {
    process.env.TEAMS_RATIO_AUDIT_CHAT_ID = "";
    const { POST } = await import("../route");
    const res = await POST(postReq(payload()));
    expect(h.sendTeamsChatMessage).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.notified).toBe(false);
    expect(json.notifyError).toBeUndefined();
  });

  it("CRON_SECRET 미설정이면 500이고 적재하지 않는다", async () => {
    process.env.CRON_SECRET = "";
    const { POST } = await import("../route");
    const res = await POST(postReq(payload()));
    expect(res.status).toBe(500);
    expect(h.insert).not.toHaveBeenCalled();
  });
});
