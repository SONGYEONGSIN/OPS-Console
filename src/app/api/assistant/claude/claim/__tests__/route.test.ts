import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  pending: [] as { id: string }[],
  claimed: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
  eqFilters: [] as [string, unknown][],
  ltFilters: [] as [string, unknown][],
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          state.eqFilters.push([col, val]);
          return chain;
        },
        lt: (col: string, val: unknown) => {
          state.ltFilters.push([col, val]);
          return chain;
        },
        order: () => chain,
        limit: () => Promise.resolve({ data: state.pending }),
        update: (patch: Record<string, unknown>) => {
          state.updates.push(patch);
          return chain;
        },
        maybeSingle: () => Promise.resolve({ data: state.claimed, error: null }),
        then: (r: (v: { error: null }) => unknown) => r({ error: null }),
      };
      return chain;
    },
  }),
}));

const { GET, POST } = await import("../route");

const req = (init: { method: string; body?: unknown; auth?: string }) =>
  new Request("http://x/api/assistant/claude/claim", {
    method: init.method,
    headers: init.auth ? { authorization: init.auth } : {},
    body: init.body ? JSON.stringify(init.body) : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe("assistant claude claim endpoint", () => {
  beforeEach(() => {
    state.pending = [];
    state.claimed = null;
    state.updates = [];
    state.eqFilters = [];
    state.ltFilters = [];
    process.env.CRON_SECRET = "s3cret";
  });

  it("CRON_SECRET이 틀리면 401 — 이 endpoint는 회사 PC 폴러 전용이다", async () => {
    const res = await GET(req({ method: "GET", auth: "Bearer wrong" }));
    expect(res.status).toBe(401);
  });

  it("오래 물고 있는 running은 실패로 정리한다 — 폴러가 죽으면 큐에 영원히 남는다", async () => {
    await GET(req({ method: "GET", auth: "Bearer s3cret" }));
    const sweep = state.updates[0];
    expect(sweep.status).toBe("failed");
    expect(String(sweep.message)).toMatch(/폴러|중단/);
    // running 인 것만, 그리고 claimed_at 이 오래된 것만 건드린다
    expect(state.eqFilters).toContainEqual(["status", "running"]);
    expect(state.ltFilters[0][0]).toBe("claimed_at");
  });

  it("정리 기준은 클라이언트 타임아웃(3분)보다 넉넉하다 — 돌고 있는 걸 뺏으면 안 된다", async () => {
    const before = Date.now();
    await GET(req({ method: "GET", auth: "Bearer s3cret" }));
    const cutoff = new Date(String(state.ltFilters[0][1])).getTime();
    expect(before - cutoff).toBeGreaterThanOrEqual(3 * 60 * 1000);
  });

  it("대기 요청이 없으면 request: null", async () => {
    const res = await GET(req({ method: "GET", auth: "Bearer s3cret" }));
    expect(await res.json()).toEqual({ ok: true, request: null });
  });

  it("가장 오래된 pending을 running으로 claim한다", async () => {
    state.pending = [{ id: "r1" }];
    state.claimed = { id: "r1", question: "경위서?", page_context: null };
    const res = await GET(req({ method: "GET", auth: "Bearer s3cret" }));
    const body = await res.json();
    expect(body.request.id).toBe("r1");
    // updates[0]은 stale 정리, [1]이 이번 claim
    expect(state.updates[1].status).toBe("running");
  });

  it("프롬프트를 서버가 만들어 내려준다 — 폴러에 로직을 두면 고칠 때마다 회사 PC를 만져야 한다", async () => {
    state.pending = [{ id: "r1" }];
    state.claimed = {
      id: "r1",
      question: "경위서 어떻게 보내지?",
      page_context: "사고보고 (/dashboard/incidents)",
    };
    const body = await (
      await GET(req({ method: "GET", auth: "Bearer s3cret" }))
    ).json();
    expect(body.request.prompt).toContain("경위서 어떻게 보내지?");
    expect(body.request.prompt).toContain("사고보고 (/dashboard/incidents)");
  });

  it("근거는 폴러가 보낸 tool_use에서 서버가 뽑는다 — 폴러는 실행만 한다", async () => {
    const res = await POST(
      req({
        method: "POST",
        auth: "Bearer s3cret",
        body: {
          id: "r1",
          ok: true,
          answer: "이렇게 매겨집니다",
          vaultRoot: "/C/vault",
          toolUses: [
            { name: "Glob", input: { pattern: "**/*.md" } },
            { name: "Read", input: { file_path: "/C/vault/개념/채번 규칙.md" } },
            { name: "Read", input: { file_path: "/etc/hosts" } },
          ],
        },
      }),
    );
    expect(res.status).toBe(200);
    const patch = state.updates[0];
    expect(patch.status).toBe("done");
    expect(patch.answer).toBe("이렇게 매겨집니다");
    // Glob은 훑기만 한 것이고, 볼트 밖 경로는 근거로 내보이지 않는다
    expect(patch.sources).toEqual(["개념/채번 규칙.md"]);
  });

  it("실패 보고는 failed로 남기고 사유를 적는다", async () => {
    await POST(
      req({
        method: "POST",
        auth: "Bearer s3cret",
        body: { id: "r1", ok: false, message: "exit 1" },
      }),
    );
    expect(state.updates[0].status).toBe("failed");
    expect(state.updates[0].message).toBe("exit 1");
  });

  it("id가 없으면 400", async () => {
    const res = await POST(
      req({ method: "POST", auth: "Bearer s3cret", body: { ok: true } }),
    );
    expect(res.status).toBe(400);
  });
});

/**
 * 초안이 만들어지면 같은 대화의 빈틈이 그걸 가리켜야 한다.
 * 폴러가 따로 알려주지 않아도 된다 — 보고에 실린 tool_use에 이미 들어 있다.
 */
describe("보고에서 빈틈-초안 연결", () => {
  beforeEach(() => {
    state.pending = [];
    state.claimed = null;
    state.updates = [];
    state.eqFilters = [];
    state.ltFilters = [];
    process.env.CRON_SECRET = "s3cret";
  });

  it("propose_doc이 있으면 그 대화의 빈틈에 초안 경로를 적는다", async () => {
    await POST(
      req({
        method: "POST",
        auth: "Bearer s3cret",
        body: {
          id: "r1",
          ok: true,
          answer: "초안을 만들었습니다",
          vaultRoot: "/C/vault",
          toolUses: [
            { name: "mcp__ops__propose_doc", input: { title: "조선대 연락처" } },
          ],
        },
      }),
    );
    const linked = state.updates.find((u) => u.proposal_path);
    expect(linked?.proposal_path).toBe("제안/조선대 연락처.md");
    expect(state.eqFilters).toContainEqual(["request_id", "r1"]);
  });

  it("초안이 없으면 빈틈을 건드리지 않는다", async () => {
    await POST(
      req({
        method: "POST",
        auth: "Bearer s3cret",
        body: {
          id: "r1",
          ok: true,
          answer: "답변",
          vaultRoot: "/C/vault",
          toolUses: [{ name: "Read", input: { file_path: "/C/vault/개념/a.md" } }],
        },
      }),
    );
    expect(state.updates.some((u) => u.proposal_path)).toBe(false);
  });
});
