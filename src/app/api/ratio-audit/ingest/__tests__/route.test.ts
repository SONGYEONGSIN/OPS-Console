import { describe, it, expect, vi, beforeEach } from "vitest";

// 실행 기록은 자동화 레지스트리(모든 잡 모듈)를 끌어와 로딩이 느리다. 여기서
// 검증할 건 인제스트지 기록이 아니므로 끊는다 — 기록 자체는 run-log.test.ts 가 본다.
vi.mock("@/features/automations/run-recorder", () => ({
  recordAutomationRun: () => Promise.resolve(),
}));


const insertResult = { data: { id: "run-1" }, error: null };
const h = vi.hoisted(() => ({
  single: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  dispatchRatioAudit: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: h.from }),
}));
vi.mock("@/features/ratio-audit/dispatch", () => ({
  dispatchRatioAudit: h.dispatchRatioAudit,
}));

const dispatched = (over: Record<string, unknown> = {}) => ({
  sent: 1,
  failed: [],
  unassignedCount: 0,
  adminNotified: true,
  ...over,
});

function payload(overrides: Record<string, unknown> = {}) {
  return {
    scannedCount: 3,
    findings: [
      {
        serviceId: 1093020,
        seq: 1,
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
    h.single.mockResolvedValue(insertResult);
    h.select.mockReturnValue({ single: h.single });
    h.insert.mockReturnValue({ select: h.select });
    h.eq.mockResolvedValue({ error: null });
    h.update.mockReturnValue({ eq: h.eq });
    h.from.mockReturnValue({ insert: h.insert, update: h.update });
    h.dispatchRatioAudit.mockResolvedValue(dispatched());
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

  it("담당자 발송 결과를 응답에 담고 notified=true 로 갱신", async () => {
    const { POST } = await import("../route");
    const res = await POST(postReq(payload()));
    expect(h.dispatchRatioAudit).toHaveBeenCalledTimes(1);
    expect(h.update).toHaveBeenCalledWith({ notified: true });
    const json = await res.json();
    expect(json.notified).toBe(true);
    expect(json.sent).toBe(1);
    expect(json.notifyError).toBeUndefined();
  });

  it("아무에게도 못 보냈으면 notified=false 로 남긴다", async () => {
    h.dispatchRatioAudit.mockResolvedValue(
      dispatched({ sent: 0, adminNotified: false, adminError: "채팅 미설정" }),
    );
    const { POST } = await import("../route");
    const res = await POST(postReq(payload()));
    expect(h.update).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.notified).toBe(false);
    expect(json.notifyError).toBe("채팅 미설정");
  });

  it("개인 발송 실패는 응답에 그대로 드러낸다", async () => {
    h.dispatchRatioAudit.mockResolvedValue(
      dispatched({ failed: [{ operatorName: "김지나", reason: "graph 500" }] }),
    );
    const { POST } = await import("../route");
    const json = await (await POST(postReq(payload()))).json();
    expect(json.failed).toEqual([
      { operatorName: "김지나", reason: "graph 500" },
    ]);
  });

  it("발송 단계가 통째로 터져도 적재는 유지하고 notified=false", async () => {
    h.dispatchRatioAudit.mockRejectedValue(new Error("운영자 조회 실패"));
    const { POST } = await import("../route");
    const res = await POST(postReq(payload()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.notified).toBe(false);
    expect(json.notifyError).toBe("운영자 조회 실패");
    expect(h.update).not.toHaveBeenCalled();
  });

  it("CRON_SECRET 미설정이면 500이고 적재하지 않는다", async () => {
    process.env.CRON_SECRET = "";
    const { POST } = await import("../route");
    const res = await POST(postReq(payload()));
    expect(res.status).toBe(500);
    expect(h.insert).not.toHaveBeenCalled();
  });
});
