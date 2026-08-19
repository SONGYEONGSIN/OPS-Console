import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  me: null as { email: string; permission: string } | null,
  inserted: [] as Record<string, unknown>[],
  updated: [] as Record<string, unknown>[],
  filters: [] as [string, unknown][],
  existing: null as Record<string, unknown> | null,
  deleted: 0,
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => Promise.resolve(state.me),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain = {
        insert: (v: Record<string, unknown> | Record<string, unknown>[]) => {
          state.inserted.push(...(Array.isArray(v) ? v : [v]));
          return chain;
        },
        update: (v: Record<string, unknown>) => {
          state.updated.push(v);
          return chain;
        },
        delete: () => {
          state.deleted += 1;
          return chain;
        },
        select: () => chain,
        eq: (c: string, v: unknown) => {
          state.filters.push([c, v]);
          return chain;
        },
        in: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: state.existing ? [state.existing] : [] }),
        maybeSingle: () => Promise.resolve({ data: state.existing, error: null }),
        single: () => Promise.resolve({ data: { id: "new" }, error: null }),
        then: (r: (v: { error: null }) => unknown) => r({ error: null }),
      };
      return chain;
    },
  }),
}));

const { requestExtraction, confirmReceipt } = await import("../extract-actions");

const RID = "ab3599d5-e6a8-4631-9342-8338ca4e4ad5";

describe("requestExtraction", () => {
  beforeEach(() => {
    state.me = { email: "me@x.com", permission: "member" };
    state.inserted = [];
    state.existing = null;
    state.filters = [];
  });

  it("로그인·권한을 본다", async () => {
    state.me = null;
    expect((await requestExtraction(RID)).ok).toBe(false);
    state.me = { email: "v@x.com", permission: "viewer" };
    expect((await requestExtraction(RID)).ok).toBe(false);
  });

  it("큐에 pending으로 넣는다", async () => {
    const r = await requestExtraction(RID);
    expect(r.ok).toBe(true);
    expect(state.inserted[0].receipt_id).toBe(RID);
    expect(state.inserted[0].requested_by).toBe("me@x.com");
  });

  it("이미 돌고 있으면 또 넣지 않는다 — 같은 영수증을 두 번 읽을 이유가 없다", async () => {
    state.existing = { id: "q1", status: "pending" };
    const r = await requestExtraction(RID);
    expect(r.ok).toBe(false);
    expect(state.inserted).toHaveLength(0);
  });

  it("영수증 id가 아니면 거부한다", async () => {
    expect((await requestExtraction("not-a-uuid")).ok).toBe(false);
  });
});

describe("confirmReceipt", () => {
  const rows = [
    { daySeq: 1, trackingNo: "A-1", fee: 100, postalCode: "12345", recipientOrg: "우석대", recipientName: "강정화", assignee: "김지현" },
  ];

  beforeEach(() => {
    state.me = { email: "me@x.com", permission: "member" };
    state.inserted = [];
    state.updated = [];
    state.deleted = 0;
    state.filters = [];
  });

  it("검토한 행을 postal_items에 넣는다", async () => {
    const r = await confirmReceipt(RID, rows);
    expect(r.ok).toBe(true);
    expect(state.inserted[0]).toMatchObject({
      receipt_id: RID,
      tracking_no: "A-1",
      assignee: "김지현",
      day_seq: 1,
    });
  });

  it("확정 시각을 영수증에 남긴다 — 엑셀에 옮겼다는 표시다", async () => {
    await confirmReceipt(RID, rows);
    expect(state.updated[0].confirmed_at).toBeTruthy();
  });

  it("다시 확정하면 이전 행을 지우고 새로 넣는다 — 고쳐서 다시 낼 수 있어야 한다", async () => {
    await confirmReceipt(RID, rows);
    expect(state.deleted).toBe(1);
  });

  it("등기번호가 빈 행은 거부한다 — 그게 없으면 엑셀에 못 쓴다", async () => {
    const r = await confirmReceipt(RID, [{ ...rows[0], trackingNo: "  " }]);
    expect(r.ok).toBe(false);
    expect(state.inserted).toHaveLength(0);
  });

  it("행이 없으면 거부한다", async () => {
    expect((await confirmReceipt(RID, [])).ok).toBe(false);
  });

  it("viewer는 확정할 수 없다", async () => {
    state.me = { email: "v@x.com", permission: "viewer" };
    expect((await confirmReceipt(RID, rows)).ok).toBe(false);
  });
});
