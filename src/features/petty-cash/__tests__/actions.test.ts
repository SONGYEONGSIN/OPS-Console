import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  me: null as { email: string; permission: string } | null,
  sheet: null as {
    entries: unknown[];
    balance: number | null;
    totalSpent: number;
    balanceCell?: { row: number; text: string } | null;
  } | null,
  patched: [] as { url: string; body: unknown }[],
  inserted: [] as string[],
  // 헤더 + 충전 + 사용 두 줄. 실제 시트 모양을 줄여 옮긴 것.
  values: [
    ["전도금內", "", "잔액", "날짜", "내용", "건수", "금액", "품목"],
    ["전도금청구", 500000, 500000, "", "", "", "", ""],
    ["", "", 496080, 46108, "우편물", 1, 3920, ""],
    ["", "", 482790, 46252, "우편물", 3, 13290, ""],
  ] as unknown[][],
  patchOk: true,
  resolved: { ok: true, name: "2026" } as { ok: true; name: string } | { ok: false; error: string },
  fetchedSheet: [] as string[],
  urls: [] as string[],
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => Promise.resolve(state.me),
}));
vi.mock("@/lib/microsoft/auth", () => ({ getGraphToken: () => Promise.resolve("tok") }));
vi.mock("../queries", () => ({
  fetchPettyCash: (name: string) => {
    state.fetchedSheet.push(name);
    return Promise.resolve(state.sheet);
  },
  resolvePettyCashSheetName: () => Promise.resolve(state.resolved),
}));

vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
  state.urls.push(String(url));
  if (init?.method === "PATCH") {
    state.patched.push({ url, body: JSON.parse(String(init.body)) });
    return { ok: state.patchOk, status: state.patchOk ? 200 : 500, text: async () => "err" };
  }
  if (init?.method === "POST") {
    // 중간 삽입 — 아래를 한 줄 밀어낸다
    state.inserted.push(String(url));
    return { ok: true, status: 200, text: async () => "" };
  }
  // usedRange 조회 — 날짜순 자리를 찾으려면 값이 필요하다
  return { ok: true, json: async () => ({ values: state.values }) };
}));

const { appendSpend } = await import("../actions");

const SPEND = { date: "2026-08-20", title: "우편물", count: 3, amount: 13290 };

describe("appendSpend", () => {
  beforeEach(() => {
    state.me = { email: "me@x.com", permission: "member" };
    state.sheet = { entries: [], balance: 500000, totalSpent: 0 };
    state.patched = [];
    state.inserted = [];
    state.patchOk = true;
    state.resolved = { ok: true, name: "2026" };
    state.fetchedSheet = [];
    state.urls = [];
    process.env.SHAREPOINT_DRIVE_ID = "d";
    process.env.SHAREPOINT_PETTY_CASH_ITEM_ID = "i";
  });

  it("로그인·권한을 본다 — 장부를 고치는 일이다", async () => {
    state.me = null;
    expect((await appendSpend(SPEND)).ok).toBe(false);
    state.me = { email: "v@x.com", permission: "viewer" };
    expect((await appendSpend(SPEND)).ok).toBe(false);
  });

  it("장부에 한 줄을 붙인다 — 값 한 번, 잔액 수식 한 번", async () => {
    const r = await appendSpend(SPEND);
    expect(r.ok).toBe(true);
    expect(state.patched).toHaveLength(2);

    const values = (state.patched[0].body as { values: unknown[][] }).values[0];
    // 날짜는 일련번호 — 문자열로 넣으면 그 행만 텍스트가 된다.
    expect(values[3]).toBe(46254);
    expect(values[6]).toBe(13290);
    // 잔액 자리는 비운다. 값으로 넣으면 그 행부터 자동 계산이 끊긴다.
    expect(values[2]).toBe("");

    const formula = state.patched[1].body as { formulas: string[][] };
    expect(formula.formulas[0][0]).toMatch(/^=\$C\d+-\$G\d+$/);
  });

  it("가장 최근 날짜면 맨 아래 — 밀어낼 것이 없다", async () => {
    await appendSpend(SPEND);
    expect(state.inserted).toHaveLength(0);
  });

  it("뒤늦게 넣는 건이면 줄을 밀어낸다 — 날짜순이 깨지면 잔액 순서가 어긋난다", async () => {
    // 46200 = 시트 중간 날짜
    await appendSpend({ ...SPEND, date: "2026-06-27", title: "사무용품" });
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toMatch(/insert$/);
  });

  it("같은 건이 이미 있으면 쓰지 않는다 — 두 번 확정해도 장부는 한 줄이다", async () => {
    state.sheet = {
      entries: [{ kind: "spend", date: "2026-08-20", title: "우편물", count: 3, amount: 13290, item: null, balance: 1 }],
      balance: 500000,
      totalSpent: 13290,
    };
    const r = await appendSpend(SPEND);
    expect(r.ok).toBe(false);
    expect(state.patched).toHaveLength(0);
  });

  it("장부를 못 읽으면 쓰지 않는다 — 잔액을 모르면 계산이 틀린다", async () => {
    state.sheet = null;
    const r = await appendSpend(SPEND);
    expect(r.ok).toBe(false);
    expect(state.patched).toHaveLength(0);
  });

  it("잔액을 못 읽어도 쓰지 않는다", async () => {
    state.sheet = { entries: [], balance: null, totalSpent: 0 };
    expect((await appendSpend(SPEND)).ok).toBe(false);
    expect(state.patched).toHaveLength(0);
  });

  // 2026-10-21 사람이 C97 을 비운 뒤 2주 동안 '현재 잔액을 읽지 못했습니다' 만 떴다.
  // 어느 칸인지 말했다면 그날 고쳤다.
  it("잔액을 못 읽으면 어느 칸이 비었는지 말한다 — 그래야 엑셀에서 고친다", async () => {
    state.sheet = {
      entries: [],
      balance: null,
      totalSpent: 0,
      balanceCell: { row: 97, text: "" },
    };
    const r = await appendSpend(SPEND);
    expect(r).toEqual({
      ok: false,
      error: "현재 잔액을 읽지 못했습니다 — '2026' 시트 97행 잔액(C) 칸이 비어 있습니다",
    });
    expect(state.patched).toHaveLength(0);
  });

  // 시트는 사람이 3월 하순에 넘긴다 — 날짜로 정하면 닫힌 시트에 쓴다. 있는 시트를 고르고,
  // 읽은 시트와 쓰는 시트가 같아야 한다.
  it("고른 시트 하나로 읽고 쓴다", async () => {
    state.resolved = { ok: true, name: "2025" };
    expect((await appendSpend(SPEND)).ok).toBe(true);
    expect(state.fetchedSheet).toEqual(["2025"]);
    const writes = state.urls.filter((u) => u.includes("/worksheets("));
    expect(writes.length).toBeGreaterThan(0);
    for (const u of writes) expect(u).toContain("worksheets('2025')");
  });

  it("시트를 못 고르면 쓰지 않고 이유를 말한다", async () => {
    state.resolved = { ok: false, error: "전도금 장부의 시트 목록을 읽지 못했습니다" };
    expect(await appendSpend(SPEND)).toEqual({
      ok: false,
      error: "전도금 장부의 시트 목록을 읽지 못했습니다",
    });
    expect(state.fetchedSheet).toHaveLength(0);
    expect(state.patched).toHaveLength(0);
  });

  it("금액이 0 이하면 거부한다", async () => {
    expect((await appendSpend({ ...SPEND, amount: 0 })).ok).toBe(false);
  });

  it("PATCH가 실패하면 실패로 알린다 — 조용히 성공이라 하지 않는다", async () => {
    state.patchOk = false;
    expect((await appendSpend(SPEND)).ok).toBe(false);
  });

  it("env가 없으면 거부한다", async () => {
    delete process.env.SHAREPOINT_PETTY_CASH_ITEM_ID;
    expect((await appendSpend(SPEND)).ok).toBe(false);
  });
});
