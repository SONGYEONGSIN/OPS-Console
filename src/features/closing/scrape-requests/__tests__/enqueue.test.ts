import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueLocalScrapeRequest, STALE_RUNNING_MS } from "../enqueue";

const NOW = new Date("2026-07-10T10:00:00+09:00");
const minutesAgo = (m: number) =>
  new Date(NOW.getTime() - m * 60_000).toISOString();

type Existing = {
  id: string;
  status: "pending" | "running";
  claimed_at: string | null;
};

/**
 * admin.from("closing_scrape_requests")
 *   .select(...).in(...).limit(...)      → 선점 행 조회
 *   .update(...).eq(...).eq(...)         → stale running 마감
 *   .insert(...)                         → 적재
 */
function mockAdmin(opts: {
  existing?: Existing[];
  selectError?: { message: string };
  updateError?: { message: string };
  insertError?: { message: string };
}) {
  const insert = vi.fn().mockResolvedValue({ error: opts.insertError ?? null });
  const limit = vi.fn().mockResolvedValue({
    data: opts.existing ?? [],
    error: opts.selectError ?? null,
  });
  const inFn = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ in: inFn }));

  const eqStatus = vi
    .fn()
    .mockResolvedValue({ error: opts.updateError ?? null });
  const eqId = vi.fn((_col: string, _val: string) => ({ eq: eqStatus }));
  const update = vi.fn((_patch: Record<string, unknown>) => ({ eq: eqId }));

  const from = vi.fn(() => ({ select, insert, update }));
  vi.mocked(createAdminClient).mockReturnValue({
    from,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return { from, insert, update, eqId, eqStatus };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("enqueueLocalScrapeRequest — 기본 적재", () => {
  it("선점 행이 없으면 requested_by와 함께 1건 적재", async () => {
    const { from, insert } = mockAdmin({ existing: [] });

    const r = await enqueueLocalScrapeRequest("admin@x.com", NOW);

    expect(r.ok).toBe(true);
    expect(from).toHaveBeenCalledWith("closing_scrape_requests");
    expect(insert).toHaveBeenCalledWith({
      requested_by: "admin@x.com",
      status: "pending",
    });
  });

  it("cron 호출도 세션 없이 적재된다 (requested_by='automation')", async () => {
    const { insert } = mockAdmin({ existing: [] });

    const r = await enqueueLocalScrapeRequest("automation", NOW);

    expect(r.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith({
      requested_by: "automation",
      status: "pending",
    });
  });
});

describe("enqueueLocalScrapeRequest — 중복 차단", () => {
  it("pending이 있으면 차단 (아직 claim 전이므로 stale 판정 대상 아님)", async () => {
    const { insert, update } = mockAdmin({
      existing: [{ id: "req-1", status: "pending", claimed_at: null }],
    });

    const r = await enqueueLocalScrapeRequest("admin@x.com", NOW);

    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/대기|진행/);
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("claim된 지 얼마 안 된 running은 차단 (정상 실행 중)", async () => {
    const { insert, update } = mockAdmin({
      existing: [
        { id: "req-1", status: "running", claimed_at: minutesAgo(10) },
      ],
    });

    const r = await enqueueLocalScrapeRequest("admin@x.com", NOW);

    expect(r.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("claimed_at이 없는 running은 판정 불가 — 차단", async () => {
    const { insert } = mockAdmin({
      existing: [{ id: "req-1", status: "running", claimed_at: null }],
    });

    const r = await enqueueLocalScrapeRequest("admin@x.com", NOW);

    expect(r.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("enqueueLocalScrapeRequest — stale running 자동 복구", () => {
  it("STALE_RUNNING_MS 초과 running은 failed로 마감하고 새 요청을 적재", async () => {
    const staleAt = minutesAgo(STALE_RUNNING_MS / 60_000 + 1);
    const { insert, update, eqId, eqStatus } = mockAdmin({
      existing: [{ id: "req-stale", status: "running", claimed_at: staleAt }],
    });

    const r = await enqueueLocalScrapeRequest("admin@x.com", NOW);

    expect(r.ok).toBe(true);
    // 기존 행 마감 — 여전히 running일 때만(경합 방지)
    expect(update).toHaveBeenCalledTimes(1);
    const patch = update.mock.calls[0][0];
    expect(patch.status).toBe("failed");
    expect(patch.finished_at).toBe(NOW.toISOString());
    expect(patch.message).toMatch(/미응답|자동 마감/);
    expect(eqId).toHaveBeenCalledWith("id", "req-stale");
    expect(eqStatus).toHaveBeenCalledWith("status", "running");
    // 그리고 새 요청 적재
    expect(insert).toHaveBeenCalledWith({
      requested_by: "admin@x.com",
      status: "pending",
    });
  });

  it("stale 마감 실패 → 적재하지 않고 ok:false", async () => {
    const staleAt = minutesAgo(60);
    const { insert } = mockAdmin({
      existing: [{ id: "req-stale", status: "running", claimed_at: staleAt }],
      updateError: { message: "update boom" },
    });

    const r = await enqueueLocalScrapeRequest("admin@x.com", NOW);

    expect(r.ok).toBe(false);
    expect(r.message).toContain("update boom");
    expect(insert).not.toHaveBeenCalled();
  });

  it("STALE_RUNNING_MS는 스크래퍼 실행 제한(20분)보다 길다", () => {
    expect(STALE_RUNNING_MS).toBeGreaterThan(20 * 60_000);
  });
});

describe("enqueueLocalScrapeRequest — 오류 전달", () => {
  it("선점 행 조회 실패 → ok:false + 원인 메시지", async () => {
    const { insert } = mockAdmin({ selectError: { message: "select boom" } });

    const r = await enqueueLocalScrapeRequest("admin@x.com", NOW);

    expect(r.ok).toBe(false);
    expect(r.message).toContain("select boom");
    expect(insert).not.toHaveBeenCalled();
  });

  it("insert 실패 → ok:false + 원인 메시지", async () => {
    mockAdmin({ existing: [], insertError: { message: "insert boom" } });

    const r = await enqueueLocalScrapeRequest("admin@x.com", NOW);

    expect(r.ok).toBe(false);
    expect(r.message).toContain("insert boom");
  });
});
