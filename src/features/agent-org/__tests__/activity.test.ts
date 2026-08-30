import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  table: null as string | null,
  filters: [] as [string, unknown][],
  rows: [] as Record<string, unknown>[],
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      state.table = t;
      const chain = {
        select: () => chain,
        eq: (c: string, v: unknown) => {
          state.filters.push([c, v]);
          return chain;
        },
        order: () => chain,
        limit: () => Promise.resolve({ data: state.rows }),
      };
      return chain;
    },
  }),
}));

const { getAgentActivity } = await import("../activity");

/**
 * 인스펙터에 "무엇을 언제 했나"를 시간순으로. 새 테이블 없이 이미 남고 있는
 * 것에서 가져온다 — 자동화 잡은 automation_runs, 폴러는 각자의 큐.
 */
describe("getAgentActivity", () => {
  beforeEach(() => {
    state.table = null;
    state.filters = [];
    state.rows = [];
  });

  it("자동화 잡은 그 잡의 실행 이력만 읽는다", async () => {
    state.rows = [
      { ran_at: "2026-08-30T10:00:00+09:00", ok: true, skipped: false, message: null },
    ];
    const out = await getAgentActivity("vault-indexer");
    expect(state.table).toBe("automation_runs");
    expect(state.filters).toContainEqual(["job_id", "knowledge-index"]);
    expect(out[0].outcome).toBe("ok");
  });

  it("회사 PC 폴러는 그 큐를 읽는다", async () => {
    state.rows = [
      {
        status: "done",
        requested_at: "2026-08-30T09:00:00+09:00",
        finished_at: "2026-08-30T09:00:40+09:00",
      },
    ];
    const out = await getAgentActivity("assistant-runner");
    expect(state.table).toBe("assistant_requests");
    expect(out[0].at).toBe("2026-08-30T09:00:40+09:00");
  });

  /**
   * 실행 이력이 없는 자리(상시 동작·예정)는 조회 자체를 안 한다 —
   * 빈 배열을 만들자고 DB 를 때릴 이유가 없다.
   */
  it("이력이 없는 자리는 조회하지 않는다", async () => {
    expect(await getAgentActivity("failure-watcher")).toEqual([]);
    expect(state.table).toBeNull();
  });

  it("모르는 에이전트는 빈 배열", async () => {
    expect(await getAgentActivity("없는-에이전트")).toEqual([]);
    expect(state.table).toBeNull();
  });
});
