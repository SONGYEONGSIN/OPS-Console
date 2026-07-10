import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueLocalScrapeRequest } from "../enqueue";

/**
 * admin.from("closing_scrape_requests")
 *   .select(...).in(...).limit(...)   → 중복 검사
 *   .insert(...)                      → 적재
 */
function mockAdmin(opts: {
  existing?: unknown[];
  selectError?: { message: string };
  insertError?: { message: string };
}) {
  const insert = vi.fn().mockResolvedValue({ error: opts.insertError ?? null });
  const limit = vi.fn().mockResolvedValue({
    data: opts.existing ?? [],
    error: opts.selectError ?? null,
  });
  const inFn = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ in: inFn }));
  const from = vi.fn(() => ({ select, insert }));
  vi.mocked(createAdminClient).mockReturnValue({
    from,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return { from, select, inFn, insert };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("enqueueLocalScrapeRequest", () => {
  it("pending 없으면 requested_by와 함께 1건 적재", async () => {
    const { from, insert } = mockAdmin({ existing: [] });

    const r = await enqueueLocalScrapeRequest("admin@x.com");

    expect(r.ok).toBe(true);
    expect(from).toHaveBeenCalledWith("closing_scrape_requests");
    expect(insert).toHaveBeenCalledWith({
      requested_by: "admin@x.com",
      status: "pending",
    });
  });

  it("cron 호출도 세션 없이 적재된다 (requested_by='automation')", async () => {
    const { insert } = mockAdmin({ existing: [] });

    const r = await enqueueLocalScrapeRequest("automation");

    expect(r.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith({
      requested_by: "automation",
      status: "pending",
    });
  });

  it("pending/running이 이미 있으면 중복 적재하지 않는다", async () => {
    const { inFn, insert } = mockAdmin({ existing: [{ id: "req-1" }] });

    const r = await enqueueLocalScrapeRequest("admin@x.com");

    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/대기|진행/);
    expect(insert).not.toHaveBeenCalled();
    expect(inFn).toHaveBeenCalledWith("status", ["pending", "running"]);
  });

  it("중복 검사 조회 실패 → ok:false + 원인 메시지", async () => {
    const { insert } = mockAdmin({ selectError: { message: "select boom" } });

    const r = await enqueueLocalScrapeRequest("admin@x.com");

    expect(r.ok).toBe(false);
    expect(r.message).toContain("select boom");
    expect(insert).not.toHaveBeenCalled();
  });

  it("insert 실패 → ok:false + 원인 메시지", async () => {
    mockAdmin({ existing: [], insertError: { message: "insert boom" } });

    const r = await enqueueLocalScrapeRequest("admin@x.com");

    expect(r.ok).toBe(false);
    expect(r.message).toContain("insert boom");
  });
});
