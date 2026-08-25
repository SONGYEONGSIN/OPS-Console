import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  rows: [] as Record<string, unknown>[],
  /** `.not(col, op, value)` 로 걸린 조건 — 제외가 실제로 쿼리에 실렸는지 본다. */
  nots: [] as [string, string, unknown][],
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        not: (c: string, op: string, v: unknown) => {
          state.nots.push([c, op, v]);
          return chain;
        },
        maybeSingle: () => Promise.resolve({ data: state.rows[0] ?? null }),
        order: () => chain,
        then: (r: (x: { data: unknown }) => unknown) => r({ data: state.rows }),
      };
      return chain;
    },
  }),
}));

const { listKnowledgeDocs, getKnowledgeDoc } = await import("../queries");

describe("listKnowledgeDocs", () => {
  beforeEach(() => {
    state.rows = [];
    state.nots = [];
  });

  /**
   * `제안/`은 사람이 아직 안 본 초안 칸이다. 그런데 초안의 category 는 폴더가
   * 아니라 **옮겨질 자리**라(frontmatter.ts), 분류로만 묶는 열람 트리에 그대로
   * 두면 승인된 지식 사이에 섞여 구분이 안 된다 — `제안/취업규칙 요점` 이
   * `규칙` 칸에 앉았다(2026-08-26).
   */
  it("제안/ 초안은 열람 목록에서 뺀다 — 승인된 지식과 섞이면 안 된다", async () => {
    await listKnowledgeDocs();
    expect(state.nots).toContainEqual(["path", "like", "제안/%"]);
  });
});

describe("getKnowledgeDoc", () => {
  beforeEach(() => {
    state.rows = [];
    state.nots = [];
  });

  it("제안/ 초안도 열린다 — 검토 목록에서 눌러 봐야 한다", async () => {
    state.rows = [
      {
        path: "제안/취업규칙 요점 (2026 개정).md",
        category: "규칙",
        title: "취업규칙 요점 (2026 개정)",
        owner: null,
        updated: null,
        related: [],
        missing: [],
        category_mismatch: false,
        body: "본문",
      },
    ];
    const doc = await getKnowledgeDoc("제안/취업규칙 요점 (2026 개정).md");
    expect(doc?.body).toBe("본문");
    expect(state.nots).toEqual([]);
  });
});
