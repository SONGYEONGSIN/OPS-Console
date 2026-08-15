import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  pending: [] as { id: string }[],
  claimed: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
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
    process.env.CRON_SECRET = "s3cret";
  });

  it("CRON_SECRET이 틀리면 401 — 이 endpoint는 회사 PC 폴러 전용이다", async () => {
    const res = await GET(req({ method: "GET", auth: "Bearer wrong" }));
    expect(res.status).toBe(401);
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
    expect(state.updates[0].status).toBe("running");
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
