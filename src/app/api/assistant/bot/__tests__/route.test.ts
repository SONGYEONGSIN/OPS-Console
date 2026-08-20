import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  inserted: null as Record<string, unknown> | null,
  operators: [{ email: "ysong2526@jinhak.com" }] as { email: string }[],
  request: null as Record<string, unknown> | null,
  filters: [] as [string, unknown][],
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          state.filters.push([col, val]);
          return chain;
        },
        insert: (v: Record<string, unknown>) => {
          state.inserted = v;
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: "req-1" }, error: null }),
            }),
          };
        },
        maybeSingle: () =>
          Promise.resolve({
            data:
              table === "operators"
                ? (state.operators.find(
                    (o) =>
                      o.email ===
                      state.filters.find(([c]) => c === "email")?.[1],
                  ) ?? null)
                : state.request,
            error: null,
          }),
      };
      return chain;
    },
  }),
}));

const { POST, GET } = await import("../route");

const post = (body: unknown, auth = "Bearer s3cret") =>
  new Request("http://x/api/assistant/bot", {
    method: "POST",
    headers: { authorization: auth },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

const get = (qs: string, auth = "Bearer s3cret") =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new Request(`http://x/api/assistant/bot${qs}`, {
    headers: { authorization: auth },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

const ask = {
  question: "이번주 휴가 누가 있어?",
  operatorEmail: "ysong2526@jinhak.com",
};

describe("Teams 봇 창구 — 질문 적재", () => {
  beforeEach(() => {
    state.inserted = null;
    state.request = null;
    state.filters = [];
    state.operators = [{ email: "ysong2526@jinhak.com" }];
    process.env.CRON_SECRET = "s3cret";
  });

  it("CRON_SECRET이 틀리면 401", async () => {
    expect((await POST(post(ask, "Bearer no"))).status).toBe(401);
  });

  it("웹 어시스턴트와 같은 큐에 넣는다 — 답이 갈리면 안 된다", async () => {
    const res = await POST(post(ask));
    expect(res.status).toBe(200);
    expect(state.inserted?.question).toBe("이번주 휴가 누가 있어?");
    expect(state.inserted?.operator_email).toBe("ysong2526@jinhak.com");
    expect((await res.json()).id).toBe("req-1");
  });

  it("운영자가 아니면 거절한다 — 비밀키만으로 아무나 사칭할 수 없다", async () => {
    const res = await POST(
      post({ ...ask, operatorEmail: "outsider@example.com" }),
    );
    expect(res.status).toBe(403);
    expect(state.inserted).toBeNull();
  });

  it("어디서 온 질문인지 남긴다 — 웹 이력에 섞여도 구분돼야 한다", async () => {
    await POST(post(ask));
    expect(String(state.inserted?.page_context)).toMatch(/Teams/);
  });

  it("빈 질문은 400", async () => {
    expect((await POST(post({ ...ask, question: "  " }))).status).toBe(400);
  });
});

describe("Teams 봇 창구 — 답 조회", () => {
  beforeEach(() => {
    state.inserted = null;
    state.request = null;
    state.filters = [];
    state.operators = [{ email: "ysong2526@jinhak.com" }];
    process.env.CRON_SECRET = "s3cret";
  });

  it("끝난 답을 돌려준다", async () => {
    state.request = {
      status: "done",
      answer: "이해영·임종우",
      sources: ["플레이북/휴가.md"],
      message: null,
    };
    const body = await (
      await GET(get("?id=req-1&operatorEmail=ysong2526@jinhak.com"))
    ).json();
    expect(body).toMatchObject({ status: "done", answer: "이해영·임종우" });
  });

  it("본인 것만 준다 — id 추측만으로 남의 질문이 새면 안 된다", async () => {
    state.request = { status: "done", answer: "x", sources: [], message: null };
    await GET(get("?id=req-1&operatorEmail=ysong2526@jinhak.com"));
    expect(state.filters).toContainEqual([
      "operator_email",
      "ysong2526@jinhak.com",
    ]);
  });

  it("없는 요청이면 404", async () => {
    state.request = null;
    expect(
      (await GET(get("?id=req-1&operatorEmail=ysong2526@jinhak.com"))).status,
    ).toBe(404);
  });

  it("id가 없으면 400", async () => {
    expect((await GET(get("?operatorEmail=ysong2526@jinhak.com"))).status).toBe(
      400,
    );
  });
});
