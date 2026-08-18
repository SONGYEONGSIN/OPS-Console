import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  me: null as { email: string; permission: string } | null,
  updated: null as Record<string, unknown> | null,
  inserted: null as Record<string, unknown> | null,
  filters: [] as [string, unknown][],
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => Promise.resolve(state.me),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain = {
      insert: (v: Record<string, unknown>) => {
        state.inserted = v;
        return Promise.resolve({ error: null });
      },
      update: (v: Record<string, unknown>) => {
        state.updated = v;
        return chain;
      },
      eq: (c: string, val: unknown) => {
        state.filters.push([c, val]);
        return chain;
      },
      then: (r: (v: { error: null }) => unknown) => r({ error: null }),
    };
    return { from: () => chain };
  },
}));

const { closeGapTopic, requestGapDraft } = await import("../gap-actions");

describe("closeGapTopic", () => {
  beforeEach(() => {
    state.me = { email: "me@x.com", permission: "member" };
    state.updated = null;
    state.filters = [];
  });

  it("로그인하지 않았으면 거부한다", async () => {
    state.me = null;
    const r = await closeGapTopic("휴가 등록 절차", "resolved");
    expect(r.ok).toBe(false);
  });

  it("viewer는 닫을 수 없다 — 남의 우선순위를 지우는 일이다", async () => {
    state.me = { email: "v@x.com", permission: "viewer" };
    const r = await closeGapTopic("휴가 등록 절차", "resolved");
    expect(r.ok).toBe(false);
  });

  it("주제 단위로 닫는다 — 화면이 주제로 묶여 보이므로 한 건만 닫으면 남는다", async () => {
    await closeGapTopic("휴가 등록 절차", "resolved");
    expect(state.filters).toContainEqual(["topic", "휴가 등록 절차"]);
    expect(state.updated?.status).toBe("resolved");
  });

  it("누가 언제 닫았는지 남긴다 — 되돌리려면 물어볼 사람이 있어야 한다", async () => {
    await closeGapTopic("휴가 등록 절차", "resolved");
    expect(state.updated?.resolved_by).toBe("me@x.com");
    expect(state.updated?.resolved_at).toBeTruthy();
  });

  it("'필요 없음'으로도 닫는다", async () => {
    await closeGapTopic("휴가 등록 절차", "dismissed");
    expect(state.updated?.status).toBe("dismissed");
  });

  it("이미 닫힌 것은 건드리지 않는다", async () => {
    await closeGapTopic("휴가 등록 절차", "resolved");
    expect(state.filters).toContainEqual(["status", "open"]);
  });

  it("모르는 상태로는 못 닫는다", async () => {
    // @ts-expect-error 런타임 방어를 확인한다
    const r = await closeGapTopic("휴가 등록 절차", "deleted");
    expect(r.ok).toBe(false);
  });

  it("빈 주제는 거부한다", async () => {
    const r = await closeGapTopic("   ", "resolved");
    expect(r.ok).toBe(false);
  });
});

describe("requestGapDraft", () => {
  beforeEach(() => {
    state.me = { email: "me@x.com", permission: "member" };
    state.inserted = null;
  });

  it("로그인·권한을 본다", async () => {
    state.me = null;
    expect((await requestGapDraft("휴가 등록 절차", ["휴가 어떻게 올려?"])).ok).toBe(
      false,
    );
    state.me = { email: "v@x.com", permission: "viewer" };
    expect((await requestGapDraft("휴가 등록 절차", ["휴가 어떻게 올려?"])).ok).toBe(
      false,
    );
  });

  it("어시스턴트 큐에 초안 요청을 넣는다 — 채팅을 다시 타이핑하지 않게", async () => {
    const r = await requestGapDraft("휴가 등록 절차", ["휴가 어떻게 올려?"]);
    expect(r.ok).toBe(true);
    expect(state.inserted?.operator_email).toBe("me@x.com");
    expect(String(state.inserted?.question)).toContain("휴가 등록 절차");
  });

  it("원문 질문을 함께 실어 보낸다 — 무엇을 써야 하는지는 원문이 알려준다", async () => {
    await requestGapDraft("휴가 등록 절차", ["휴가 어떻게 올려?", "연차 등록은?"]);
    const q = String(state.inserted?.question);
    expect(q).toContain("휴가 어떻게 올려?");
    expect(q).toContain("연차 등록은?");
  });

  it("지어내지 말라는 조건을 붙인다 — 근거 없는 초안이 쌓이면 오류가 증폭된다", async () => {
    await requestGapDraft("휴가 등록 절차", ["q"]);
    expect(String(state.inserted?.question)).toMatch(/지어내지|근거/);
  });

  it("빈 주제는 거부한다", async () => {
    expect((await requestGapDraft("  ", ["q"])).ok).toBe(false);
  });
});
