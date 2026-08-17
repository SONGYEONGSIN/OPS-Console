import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  rows: null as Record<string, unknown>[] | null,
  filters: [] as [string, unknown][],
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
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

const { listOpenGaps } = await import("../gaps");

describe("listOpenGaps", () => {
  beforeEach(() => {
    state.rows = null;
    state.filters = [];
  });

  it("아직 안 채운 것만 가져온다 — 이미 쓴 문서를 또 쓰라고 하면 안 된다", async () => {
    state.rows = [];
    await listOpenGaps();
    expect(state.filters).toContainEqual(["status", "open"]);
  });

  it("DB의 snake_case를 화면이 쓰는 이름으로 옮긴다", async () => {
    state.rows = [
      {
        id: "g1",
        kind: "shallow",
        topic: "백업요청 화면 조작",
        note: "버튼 순서가 없음",
        near_paths: ["플레이북/백업 요청 그룹별 발송.md"],
        question: "백업요청 어떻게 해?",
        created_at: "2026-08-18T00:00:00Z",
      },
    ];
    const [g] = await listOpenGaps();
    expect(g.nearPaths).toEqual(["플레이북/백업 요청 그룹별 발송.md"]);
    expect(g.createdAt).toBe("2026-08-18T00:00:00Z");
    expect(g.kind).toBe("shallow");
  });

  it("near_paths가 비어 있으면 빈 배열 — null이 화면까지 새면 map에서 터진다", async () => {
    state.rows = [
      {
        id: "g1",
        kind: "missing",
        topic: "휴가",
        note: null,
        near_paths: null,
        question: "q",
        created_at: "2026-08-18T00:00:00Z",
      },
    ];
    const [g] = await listOpenGaps();
    expect(g.nearPaths).toEqual([]);
    expect(g.note).toBeNull();
  });

  it("조회 결과가 없으면 빈 배열", async () => {
    state.rows = null;
    expect(await listOpenGaps()).toEqual([]);
  });
});
