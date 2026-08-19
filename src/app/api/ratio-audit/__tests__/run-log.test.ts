import { describe, it, expect, vi, beforeEach } from "vitest";

const recorded: { jobId: string; outcome: Record<string, unknown> }[] = [];
vi.mock("@/features/automations/run-recorder", () => ({
  recordAutomationRun: (jobId: string, outcome: Record<string, unknown>) => {
    recorded.push({ jobId, outcome });
    return Promise.resolve();
  },
}));

const state = {
  rows: [] as Record<string, unknown>[],
  row: null as Record<string, unknown> | null,
};
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain: Record<string, unknown> = {};
    Object.assign(chain, {
      from: () => chain,
      insert: (p: Record<string, unknown>) => {
        state.rows.push(p);
        return chain;
      },
      update: (p: Record<string, unknown>) => {
        state.rows.push(p);
        return chain;
      },
      select: () => chain,
      eq: () => chain,
      single: () =>
        Promise.resolve({ data: state.row ?? { id: "run-1" }, error: null }),
      maybeSingle: () => Promise.resolve({ data: state.row, error: null }),
      then: (r: (v: { error: null }) => unknown) => r({ error: null }),
    });
    return chain;
  },
}));

vi.mock("@/features/ratio-audit/dispatch", () => ({
  dispatchRatioAudit: () =>
    Promise.resolve({
      sent: 2,
      failed: [],
      unassignedCount: 0,
      excludedCount: 0,
      adminNotified: true,
    }),
}));

const { POST: ingestPost } = await import("../ingest/route");
const { POST: reportPost } = await import("../audit-request/route");

const req = (url: string, body: unknown, auth = "Bearer s3cret") =>
  new Request(url, {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

/**
 * 경쟁률 점검 결과가 자동화 실행 로그에 남아야 한다.
 *
 * 지금까지 남던 건 **큐 적재뿐**이라, 8/3 실행이 트레이스백으로 죽었는데도 화면엔
 * "성공"만 떠 있었다(2026-08-19 확인). 실행 결과를 알 길이 없었다.
 */
describe("경쟁률 점검 — 자동화 실행 로그 적재", () => {
  beforeEach(() => {
    recorded.length = 0;
    state.rows = [];
    state.row = null;
    process.env.CRON_SECRET = "s3cret";
  });

  it("결과를 적재하면 실행 로그에도 남긴다", async () => {
    await ingestPost(
      req("http://x/api/ratio-audit/ingest", {
        kind: "schedule",
        scannedCount: 241,
        findings: [],
        linkErrors: [],
        skipped: [],
      }),
    );
    expect(recorded).toHaveLength(1);
    expect(recorded[0].jobId).toBe("ratio-audit");
    expect(recorded[0].outcome.ok).toBe(true);
    expect(String(recorded[0].outcome.message)).toContain("검사 241건");
  });

  it("페이지 점검은 다른 잡으로 남긴다 — 섞으면 안 도는 잡이 도는 줄 안다", async () => {
    await ingestPost(
      req("http://x/api/ratio-audit/ingest", {
        kind: "page",
        scannedCount: 10,
        findings: [],
        linkErrors: [],
        skipped: [],
      }),
    );
    expect(recorded[0].jobId).toBe("ratio-page-check");
  });

  it("폴러가 실패를 보고하면 실패로 남긴다 — 이게 없어서 죽은 줄 몰랐다", async () => {
    state.row = { kind: "schedule" };
    await reportPost(
      req("http://x/api/ratio-audit/audit-request", {
        id: "r1",
        ok: false,
        message: "로그인 실패: Traceback (most recent call last)",
      }),
    );
    expect(recorded).toHaveLength(1);
    expect(recorded[0].jobId).toBe("ratio-audit");
    expect(recorded[0].outcome.ok).toBe(false);
    expect(String(recorded[0].outcome.message)).toContain("로그인 실패");
  });

  it("성공 보고는 이중으로 남기지 않는다 — 결과 적재가 이미 남겼다", async () => {
    state.row = { kind: "schedule" };
    await reportPost(
      req("http://x/api/ratio-audit/audit-request", { id: "r1", ok: true }),
    );
    expect(recorded).toHaveLength(0);
  });
});
