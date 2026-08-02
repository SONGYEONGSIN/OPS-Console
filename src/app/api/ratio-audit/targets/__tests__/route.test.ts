import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/ratio-audit/queries", () => ({
  listRatioAuditTargets: vi.fn(),
}));

const { listRatioAuditTargets } = await import("@/features/ratio-audit/queries");

function getReq(auth?: string): Request {
  return new Request("http://localhost/api/ratio-audit/targets", {
    method: "GET",
    headers: auth ? { authorization: auth } : {},
  });
}

describe("GET /api/ratio-audit/targets", () => {
  beforeEach(() => {
    vi.mocked(listRatioAuditTargets).mockReset();
    process.env.CRON_SECRET = "s3cret";
  });

  it("인증 헤더 없으면 401", async () => {
    const { GET } = await import("../route");
    const res = await GET(getReq());
    expect(res.status).toBe(401);
    expect(listRatioAuditTargets).not.toHaveBeenCalled();
  });

  it("secret 불일치면 401", async () => {
    const { GET } = await import("../route");
    const res = await GET(getReq("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("인증되면 대상 목록을 반환", async () => {
    vi.mocked(listRatioAuditTargets).mockResolvedValue([
      { serviceId: 1093020, universityName: "성신여자대학교", serviceName: "수시", operatorName: "김지영" },
    ]);
    const { GET } = await import("../route");
    const res = await GET(getReq("Bearer s3cret"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.targets).toHaveLength(1);
    expect(json.targets[0].serviceId).toBe(1093020);
  });
});
