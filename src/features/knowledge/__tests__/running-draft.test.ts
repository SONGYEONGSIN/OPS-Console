import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  me: { email: "me@x.com" } as { email: string } | null,
  rows: [] as Record<string, unknown>[],
  filters: [] as [string, unknown][],
  ins: [] as [string, unknown][],
};

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => Promise.resolve(state.me),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: (c: string, v: unknown) => {
          state.filters.push([c, v]);
          return chain;
        },
        in: (c: string, v: unknown) => {
          state.ins.push([c, v]);
          return chain;
        },
        order: () => chain,
        limit: () => Promise.resolve({ data: state.rows }),
      };
      return chain;
    },
  }),
}));

const { getRunningFileDraft } = await import("../running-draft");

/**
 * 탭이 URL 이라 다른 탭에 다녀오면 초안 화면이 통째로 죽는다. 그때 진행 중이던
 * 요청을 못 찾으면 답이 사라져, 되묻기를 아무도 못 보던 문제가 그대로 재발한다.
 */
describe("getRunningFileDraft", () => {
  beforeEach(() => {
    state.me = { email: "me@x.com" };
    state.rows = [];
    state.filters = [];
    state.ins = [];
  });

  it("아직 도는 중인 내 요청을 돌려준다", async () => {
    state.rows = [{ id: "req-9", question: "Q본문" }];
    const r = await getRunningFileDraft();
    expect(r).toEqual({ id: "req-9", question: "Q본문" });
  });

  it("내 것만 본다 — 남의 질문이 뜨면 안 된다", async () => {
    state.rows = [{ id: "r", question: "q" }];
    await getRunningFileDraft();
    expect(state.filters).toContainEqual(["operator_email", "me@x.com"]);
  });

  it("이 화면에서 만든 것만 본다", async () => {
    state.rows = [{ id: "r", question: "q" }];
    await getRunningFileDraft();
    expect(state.filters).toContainEqual([
      "page_context",
      "지식망 — 파일로 초안",
    ]);
  });

  it("끝난 요청은 안 가져온다 — 어제 답이 오늘 떠 있으면 혼란이다", async () => {
    state.rows = [{ id: "r", question: "q" }];
    await getRunningFileDraft();
    expect(state.ins).toContainEqual(["status", ["pending", "running"]]);
  });

  it("도는 게 없으면 null", async () => {
    state.rows = [];
    expect(await getRunningFileDraft()).toBeNull();
  });

  it("로그인 안 했으면 null — 조회 자체를 안 한다", async () => {
    state.me = null;
    expect(await getRunningFileDraft()).toBeNull();
    expect(state.filters).toEqual([]);
  });
});
