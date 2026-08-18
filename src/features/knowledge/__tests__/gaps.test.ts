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

const { listOpenGaps, listPendingProposals } = await import("../gaps");

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

/**
 * 검토 대기 중인 초안은 빈틈과 별개로 보여준다.
 *
 * 어느 빈틈에서 나왔는지는 대화(request_id)로만 알 수 있고, 그 기록이 없는
 * 초안도 있다. 제목으로 짐작해 이어붙이면 틀린 연결이 생기므로, 짐작하지 않고
 * "검토 대기 N건"으로 따로 세운다 — 사람이 또 쓰는 것만 막으면 된다.
 */
describe("listPendingProposals", () => {
  beforeEach(() => {
    state.rows = null;
    state.filters = [];
  });

  it("제안 폴더 문서만 가져온다", async () => {
    state.rows = [];
    await listPendingProposals();
    expect(state.filters).toContainEqual(["category", "제안"]);
  });

  it("경로와 제목을 돌려준다", async () => {
    state.rows = [
      { path: "제안/부산대학교 수시 서비스 세팅.md", title: "부산대학교 수시 서비스 세팅" },
    ];
    const [d] = await listPendingProposals();
    expect(d.path).toBe("제안/부산대학교 수시 서비스 세팅.md");
    expect(d.title).toBe("부산대학교 수시 서비스 세팅");
  });

  it("없으면 빈 배열", async () => {
    state.rows = null;
    expect(await listPendingProposals()).toEqual([]);
  });
});
