import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/ratio-audit/queries", () => ({
  listRatioAuditTargets: vi.fn(),
}));
vi.mock("@/features/ratio-audit/audit-requests/request-filters", () => ({
  loadRequestFilters: vi.fn(),
}));

const { listRatioAuditTargets } =
  await import("@/features/ratio-audit/queries");
const { loadRequestFilters } =
  await import("@/features/ratio-audit/audit-requests/request-filters");

// zod 4 uuid() 는 버전 니블이 맞아야 통과한다
const ID = "00000000-0000-4000-8000-000000000001";

function getReq(auth?: string, requestId?: string): Request {
  const url = new URL("http://localhost/api/ratio-audit/targets");
  if (requestId !== undefined) url.searchParams.set("requestId", requestId);
  return new Request(url, {
    method: "GET",
    headers: auth ? { authorization: auth } : {},
  });
}

describe("GET /api/ratio-audit/targets", () => {
  beforeEach(() => {
    vi.mocked(listRatioAuditTargets).mockReset();
    vi.mocked(loadRequestFilters).mockReset();
    process.env.CRON_SECRET = "s3cret";
  });

  it("CRON_SECRET 미설정이면 500이고 조회는 호출되지 않음", async () => {
    process.env.CRON_SECRET = "";
    const { GET } = await import("../route");
    const res = await GET(getReq("Bearer s3cret", ID));
    expect(res.status).toBe(500);
    expect(loadRequestFilters).not.toHaveBeenCalled();
    expect(listRatioAuditTargets).not.toHaveBeenCalled();
  });

  it("인증 헤더 없으면 401", async () => {
    const { GET } = await import("../route");
    const res = await GET(getReq(undefined, ID));
    expect(res.status).toBe(401);
    expect(loadRequestFilters).not.toHaveBeenCalled();
    expect(listRatioAuditTargets).not.toHaveBeenCalled();
  });

  it("secret 불일치면 401", async () => {
    const { GET } = await import("../route");
    const res = await GET(getReq("Bearer wrong", ID));
    expect(res.status).toBe(401);
  });

  it("requestId 가 없거나 uuid 가 아니면 400 bad_request, 조회 안 함", async () => {
    const { GET } = await import("../route");
    for (const bad of [undefined, "", "not-a-uuid"]) {
      const res = await GET(getReq("Bearer s3cret", bad));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.code).toBe("bad_request");
    }
    expect(loadRequestFilters).not.toHaveBeenCalled();
    expect(listRatioAuditTargets).not.toHaveBeenCalled();
  });

  it("없는 요청은 404 not_found", async () => {
    vi.mocked(loadRequestFilters).mockResolvedValue({ status: "not_found" });
    const { GET } = await import("../route");
    const res = await GET(getReq("Bearer s3cret", ID));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe("not_found");
    expect(listRatioAuditTargets).not.toHaveBeenCalled();
  });

  it("조건 없는 요청은 409 missing_filters — 폴러가 로그인 전에 멈춘다", async () => {
    vi.mocked(loadRequestFilters).mockResolvedValue({
      status: "missing_filters",
    });
    const { GET } = await import("../route");
    const res = await GET(getReq("Bearer s3cret", ID));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("missing_filters");
    expect(listRatioAuditTargets).not.toHaveBeenCalled();
  });

  it("대상과 조건 한 줄을 함께 준다", async () => {
    vi.mocked(loadRequestFilters).mockResolvedValue({
      status: "found",
      filters: { univ: ["2년제"], recruit: ["수시"] },
    });
    vi.mocked(listRatioAuditTargets).mockResolvedValue([
      {
        serviceId: 9001001,
        universityName: "테스트대학교A",
        serviceName: "수시",
        operatorName: "운영자A",
      },
    ]);
    const { GET } = await import("../route");
    const res = await GET(getReq("Bearer s3cret", ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.targets).toHaveLength(1);
    expect(json.targets[0].serviceId).toBe(9001001);
    expect(json.condition).toEqual({
      requestId: ID,
      line: "조건: 2년제 · 수시 · 접수 마감 전 — 대상 1건",
    });
    expect(loadRequestFilters).toHaveBeenCalledWith(ID);
    expect(listRatioAuditTargets).toHaveBeenCalledWith(
      { univ: ["2년제"], recruit: ["수시"] },
      expect.any(Date),
    );
  });

  it("조건 조회가 던지면 500", async () => {
    vi.mocked(loadRequestFilters).mockRejectedValue(new Error("boom"));
    const { GET } = await import("../route");
    const res = await GET(getReq("Bearer s3cret", ID));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(listRatioAuditTargets).not.toHaveBeenCalled();
  });
});
