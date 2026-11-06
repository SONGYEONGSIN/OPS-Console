import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import {
  enqueueStatusRefresh,
  isStaleRunning,
  STALE_RUNNING_MS,
} from "../enqueue";

const NOW = new Date("2026-11-07T10:00:00+09:00");
const minutesAgo = (m: number) =>
  new Date(NOW.getTime() - m * 60_000).toISOString();
const BUSY = "이미 대기/진행 중인 최신화가 있습니다. 끝나면 다시 누르세요.";
const FAILED = "최신화 요청을 처리하지 못했습니다. 잠시 뒤 다시 시도하세요.";

type Existing = {
  id: string;
  status: "pending" | "running";
  claimed_at: string | null;
};

/**
 * admin.from("sms_status_refresh_requests")
 *   .select(...).in(...).limit(...)      → 선점 행 조회
 *   .update(...).eq(...).eq(...)         → stale running 마감
 *   .insert(...)                         → 적재
 */
function mockAdmin(opts: {
  existing?: Existing[];
  selectError?: { message: string };
  updateError?: { message: string };
  insertError?: { message: string; code?: string };
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
  } as unknown as ReturnType<typeof createAdminClient>);
  return { from, insert, update, eqId, eqStatus };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("enqueueStatusRefresh", () => {
  it("활성 요청이 없으면 pending 1건", async () => {
    const { from, insert } = mockAdmin({ existing: [] });
    const r = await enqueueStatusRefresh("op-a", NOW);
    expect(r.ok).toBe(true);
    expect(r.message).toContain("인증 문자");
    expect(from).toHaveBeenCalledWith("sms_status_refresh_requests");
    expect(insert).toHaveBeenCalledWith({
      requested_by: "op-a",
      status: "pending",
    });
  });

  it("pending/running 이 있으면 적재하지 않는다", async () => {
    const { insert, update } = mockAdmin({
      existing: [{ id: "req-1", status: "pending", claimed_at: null }],
    });
    const r = await enqueueStatusRefresh("op-a", NOW);
    expect(r).toEqual({ ok: false, message: BUSY });
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("40분 지난 running 은 failed 로 마감한 뒤 적재", async () => {
    const { insert, update, eqId, eqStatus } = mockAdmin({
      existing: [
        { id: "req-1", status: "running", claimed_at: minutesAgo(41) },
      ],
    });
    const r = await enqueueStatusRefresh("op-a", NOW);
    expect(STALE_RUNNING_MS).toBe(40 * 60_000);
    expect(update).toHaveBeenCalledWith({
      status: "failed",
      finished_at: NOW.toISOString(),
      message: "폴러 claim 후 40분 이상 미응답 — 자동 마감",
    });
    expect(eqId).toHaveBeenCalledWith("id", "req-1");
    expect(eqStatus).toHaveBeenCalledWith("status", "running");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(true);
  });

  it("39분 running 은 막는다", async () => {
    const { insert, update } = mockAdmin({
      existing: [
        { id: "req-1", status: "running", claimed_at: minutesAgo(39) },
      ],
    });
    const r = await enqueueStatusRefresh("op-a", NOW);
    expect(r).toEqual({ ok: false, message: BUSY });
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("claimed_at 이 없는 running 은 판정 불가 — 막는다", async () => {
    const { insert } = mockAdmin({
      existing: [{ id: "req-1", status: "running", claimed_at: null }],
    });
    const r = await enqueueStatusRefresh("op-a", NOW);
    expect(r.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("insert 23505(동시에 누름)는 진행 중 안내", async () => {
    mockAdmin({
      existing: [],
      insertError: { message: "duplicate key value", code: "23505" },
    });
    const r = await enqueueStatusRefresh("op-a", NOW);
    expect(r).toEqual({ ok: false, message: BUSY });
  });

  // DB 원문은 화면에 내보내지 않는다 — 값이 섞일 수 있다. 서버 로그에도 코드만.
  const RAW = "Key (requested_by)=(op-a) boom";

  it("그 밖의 insert 오류는 고정 문구, 원문은 화면·로그에 없다", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mockAdmin({ existing: [], insertError: { message: RAW, code: "XX000" } });
    const r = await enqueueStatusRefresh("op-a", NOW);
    expect(r).toEqual({ ok: false, message: FAILED });
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(RAW);
    log.mockRestore();
  });

  it("조회 오류는 고정 문구", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { insert } = mockAdmin({ selectError: { message: RAW } });
    const r = await enqueueStatusRefresh("op-a", NOW);
    expect(r).toEqual({ ok: false, message: FAILED });
    expect(JSON.stringify(log.mock.calls)).not.toContain(RAW);
    expect(insert).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("마감 오류는 고정 문구, 적재 안 함", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { insert } = mockAdmin({
      existing: [
        { id: "req-1", status: "running", claimed_at: minutesAgo(90) },
      ],
      updateError: { message: RAW },
    });
    const r = await enqueueStatusRefresh("op-a", NOW);
    expect(r).toEqual({ ok: false, message: FAILED });
    expect(JSON.stringify(log.mock.calls)).not.toContain(RAW);
    expect(insert).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("isStaleRunning", () => {
  it("claim 후 40분이 넘은 running 만", () => {
    expect(
      isStaleRunning({ status: "running", claimed_at: minutesAgo(41) }, NOW),
    ).toBe(true);
    expect(
      isStaleRunning({ status: "running", claimed_at: minutesAgo(39) }, NOW),
    ).toBe(false);
    expect(
      isStaleRunning({ status: "pending", claimed_at: minutesAgo(90) }, NOW),
    ).toBe(false);
    expect(isStaleRunning({ status: "running", claimed_at: null }, NOW)).toBe(
      false,
    );
  });
});
