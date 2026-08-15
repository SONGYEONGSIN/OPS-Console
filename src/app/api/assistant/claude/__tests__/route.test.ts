import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  operator: null as { email: string } | null,
  inserted: null as Record<string, unknown> | null,
  row: null as Record<string, unknown> | null,
  lastFilters: [] as [string, unknown][],
};

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => Promise.resolve(state.operator),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain = {
        insert: (v: Record<string, unknown>) => {
          state.inserted = v;
          return chain;
        },
        select: () => chain,
        eq: (col: string, val: unknown) => {
          state.lastFilters.push([col, val]);
          return chain;
        },
        single: () => Promise.resolve({ data: { id: "new-id" }, error: null }),
        maybeSingle: () => Promise.resolve({ data: state.row, error: null }),
      };
      return chain;
    },
  }),
}));

const { POST, GET } = await import("../route");

const post = (body: unknown) =>
   
  new Request("http://x/api/assistant/claude", {
    method: "POST",
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const get = (id: string) => new Request(`http://x/api/assistant/claude?id=${id}`) as any;

describe("assistant claude 요청 endpoint", () => {
  beforeEach(() => {
    state.operator = { email: "me@jinhak.com" };
    state.inserted = null;
    state.row = null;
    state.lastFilters = [];
  });

  it("로그인하지 않았으면 401", async () => {
    state.operator = null;
    expect((await POST(post({ question: "x" }))).status).toBe(401);
  });

  it("질문을 pending으로 적재하고 id를 돌려준다", async () => {
    const res = await POST(post({ question: "경위서 어떻게 보내지?" }));
    expect(await res.json()).toEqual({ ok: true, id: "new-id" });
    expect(state.inserted?.question).toBe("경위서 어떻게 보내지?");
    expect(state.inserted?.operator_email).toBe("me@jinhak.com");
  });

  it("빈 질문은 400", async () => {
    expect((await POST(post({ question: "   " }))).status).toBe(400);
  });

  it("화면 컨텍스트를 함께 적재한다", async () => {
    await POST(
      post({ question: "이거 뭐야", pageContext: "사고보고 (/dashboard/incidents)" }),
    );
    expect(state.inserted?.page_context).toBe("사고보고 (/dashboard/incidents)");
  });

  it("조회는 본인 것만 — 남의 요청 id를 넣어도 못 읽게 이메일로 함께 건다", async () => {
    state.row = { id: "r1", status: "done", answer: "답", sources: [] };
    await GET(get("r1"));
    expect(state.lastFilters).toContainEqual(["operator_email", "me@jinhak.com"]);
  });

  it("아직 안 끝났으면 상태만 돌려준다", async () => {
    state.row = { id: "r1", status: "running", answer: null, sources: [] };
    const body = await (await GET(get("r1"))).json();
    expect(body.status).toBe("running");
    expect(body.answer).toBeNull();
  });

  it("없는 요청이면 404", async () => {
    state.row = null;
    expect((await GET(get("nope"))).status).toBe(404);
  });
});
