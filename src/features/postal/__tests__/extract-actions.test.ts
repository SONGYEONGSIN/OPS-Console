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
const { appendSpy, ledgerSpy, results } = vi.hoisted(() => ({
  appendSpy: vi.fn(),
  ledgerSpy: vi.fn(),
  // 테스트마다 성공/실패를 갈아끼운다.
  results: { petty: { ok: true } as unknown, ledger: { ok: true } as unknown },
}));
vi.mock("../ledger-append", () => ({
  appendToLedger: (...a: unknown[]) => {
    ledgerSpy(...a);
    return Promise.resolve(results.ledger);
  },
}));
vi.mock("@/features/petty-cash/actions", () => ({
  appendSpend: (...a: unknown[]) => {
    appendSpy(...a);
    return Promise.resolve(results.petty);
  },
}));
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

/**
 * 확정하면 전도금 장부에도 한 줄이 붙는다 — 손으로 옮겨 적던 일이다.
 * 다만 장부 쓰기가 실패해도 확정 자체는 살린다: postal_items 는 이미 저장됐고,
 * 여기서 실패라고 하면 사람이 다시 확정을 눌러 중복 저장으로 이어진다.
 */
describe("confirmReceipt — 전도금 반영", () => {
  const rows = [
    { daySeq: 1, trackingNo: "A-1", fee: 4590, postalCode: "1", recipientOrg: "우석대", recipientName: "강", assignee: "김지현" },
    { daySeq: 2, trackingNo: "A-2", fee: 4230, postalCode: "2", recipientOrg: "한림대", recipientName: "김", assignee: "김승현" },
  ];

  beforeEach(() => {
    state.me = { email: "me@x.com", permission: "member" };
    state.inserted = [];
    state.updated = [];
    state.deleted = 0;
    appendSpy.mockClear();
  });

  it("건수와 요금 합을 장부에 넘긴다", async () => {
    await confirmReceipt(RID, rows, { acceptedAt: "2026-08-20" });
    expect(appendSpy).toHaveBeenCalledWith({
      date: "2026-08-20",
      title: "우편물",
      count: 2,
      amount: 8820,
    });
  });

  it("접수일자가 없으면 장부에 쓰지 않는다 — 날짜 없는 줄은 장부를 망친다", async () => {
    const r = await confirmReceipt(RID, rows, {});
    expect(r.ok).toBe(true);
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("요금이 다 비면 쓰지 않는다", async () => {
    await confirmReceipt(RID, rows.map((r) => ({ ...r, fee: null })), { acceptedAt: "2026-08-20" });
    expect(appendSpy).not.toHaveBeenCalled();
  });
});

/**
 * 확정하면 두 대장에 옮겨 적는다. **실패해도 확정 자체는 살린다** — postal_items 는
 * 이미 저장됐고 실패라고 하면 사람이 다시 눌러 중복 기록이 된다.
 *
 * 그래서 조용히 실패할 수 있는 자리다. 무슨 일이 있었는지 화면에 돌려준다.
 */
describe("confirmReceipt — 대장 반영 결과", () => {
  const rows = [
    {
      daySeq: 1,
      trackingNo: "A-1",
      fee: 100,
      postalCode: "12345",
      recipientOrg: "우석대",
      recipientName: "강정화",
      assignee: "김지현",
    },
  ];

  beforeEach(() => {
    state.me = { email: "me@x.com", permission: "member" };
    results.petty = { ok: true };
    results.ledger = { ok: true };
  });

  const meta = { acceptedAt: "2026-08-21 15:44" };

  it("둘 다 적히면 둘 다 written", async () => {
    const r = await confirmReceipt(RID, rows, meta);
    expect(r.ok && r.outcome.ledger.status).toBe("written");
    expect(r.ok && r.outcome.pettyCash.status).toBe("written");
  });

  it("대장이 실패해도 확정은 성공이다 — 다시 누르면 중복이 된다", async () => {
    results.ledger = { ok: false, error: "시트 잠김" };
    const r = await confirmReceipt(RID, rows, meta);
    expect(r.ok).toBe(true);
    expect(r.ok && r.outcome.ledger.status).toBe("failed");
  });

  it("실패 사유를 그대로 준다 — 무엇을 해야 할지는 사유에 있다", async () => {
    results.petty = { ok: false, error: "잔액을 못 읽음" };
    const r = await confirmReceipt(RID, rows, meta);
    expect(
      r.ok && r.outcome.pettyCash.status === "failed" && r.outcome.pettyCash.error,
    ).toBe("잔액을 못 읽음");
  });

  it("접수일시를 못 읽었으면 건너뛴다 — 왜 안 갔는지 말해준다", async () => {
    const r = await confirmReceipt(RID, rows, { acceptedAt: null });
    expect(r.ok && r.outcome.ledger.status).toBe("skipped");
    expect(r.ok && r.outcome.pettyCash.status).toBe("skipped");
  });

  it("금액이 0이면 전도금은 건너뛴다 — 장부에 0원 줄을 남기지 않는다", async () => {
    const free = rows.map((x) => ({ ...x, fee: 0 }));
    const r = await confirmReceipt(RID, free, meta);
    expect(r.ok && r.outcome.pettyCash.status).toBe("skipped");
    expect(r.ok && r.outcome.ledger.status).toBe("written");
  });
});
