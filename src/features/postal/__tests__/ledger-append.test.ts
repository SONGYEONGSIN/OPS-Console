import { describe, it, expect, vi, beforeEach } from "vitest";
import { LEDGER_HEADERS } from "../ledger-parse";

const state = {
  sheets: ["2026년도 우편물발송(04월~)"],
  values: [] as unknown[][],
  patched: [] as { url: string; body: Record<string, unknown> }[],
  inserted: [] as string[],
  patchOk: true,
};

vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: () => Promise.resolve("tok"),
}));

vi.stubGlobal(
  "fetch",
  vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      state.patched.push({ url: String(url), body: JSON.parse(String(init.body)) });
      return { ok: state.patchOk, status: 200, text: async () => "" };
    }
    if (init?.method === "POST") {
      state.inserted.push(String(url));
      return { ok: true, status: 200, text: async () => "" };
    }
    if (String(url).includes("/worksheets?") || String(url).endsWith("/worksheets")) {
      return { ok: true, json: async () => ({ value: state.sheets.map((name) => ({ name })) }) };
    }
    return { ok: true, json: async () => ({ values: state.values }) };
  }),
);

const { appendToLedger } = await import("../ledger-append");

const ROWS = [
  {
    trackingNo: "11263-1102-7090",
    recipientOrg: "재능대학교",
    recipientName: "이도현",
    assignee: "박시현",
  },
];

/**
 * 확정한 등기를 대장에 붙인다.
 *
 * 지금까지는 확정해도 DB와 전도금에만 들어가고 **등기대장은 손으로** 적었다.
 */
describe("appendToLedger", () => {
  beforeEach(() => {
    process.env.SHAREPOINT_DRIVE_ID = "d";
    process.env.SHAREPOINT_MAIL_ITEM_ID = "i";
    state.sheets = ["2026년도 우편물발송(04월~)"];
    state.values = [
      [...LEDGER_HEADERS],
      [1, 46252, "우석대학교", "강정화", "김지현", "박수정", "…7080", ""],
      [1, 46253, "두원공과대학교", "고희관", "김슬기", "박수정", "…5431", ""],
    ];
    state.patched = [];
    state.inserted = [];
    state.patchOk = true;
  });

  it("그날 순번을 이어 대장에 쓴다", async () => {
    const r = await appendToLedger(ROWS, {
      sentOn: "2026-08-19",
      confirmedBy: "박수정",
    });
    expect(r.ok).toBe(true);
    const values = (state.patched[0].body as { values: unknown[][] }).values[0];
    expect(values[0]).toBe(2); // 8/19 는 1건 있었다
    expect(values[1]).toBe(46253); // 일련번호
    expect(values[5]).toBe("박수정"); // 확인 = 올린 사람
    expect(values[6]).toBe("11263-1102-7090");
  });

  it("중간 날짜면 줄을 밀어낸다", async () => {
    await appendToLedger(ROWS, { sentOn: "2026-08-18", confirmedBy: "박수정" });
    expect(state.inserted).toHaveLength(1);
  });

  it("그 해 시트가 없으면 쓰지 않는다 — 엉뚱한 시트에 쓰면 못 되돌린다", async () => {
    state.sheets = ["2025년도 우편물발송(04월~)"];
    const r = await appendToLedger(ROWS, {
      sentOn: "2026-08-19",
      confirmedBy: "박수정",
    });
    expect(r.ok).toBe(false);
    expect(state.patched).toHaveLength(0);
  });

  it("같은 등기번호가 이미 있으면 쓰지 않는다 — 두 번 확정해도 한 줄이다", async () => {
    state.values.push([2, 46253, "x", "y", "z", "박수정", "11263-1102-7090", ""]);
    const r = await appendToLedger(ROWS, {
      sentOn: "2026-08-19",
      confirmedBy: "박수정",
    });
    expect(r.ok).toBe(false);
    expect(String(r.ok === false && r.error)).toMatch(/이미/);
    expect(state.patched).toHaveLength(0);
  });

  it("시트를 못 읽으면 쓰지 않는다 — 1행(헤더)을 덮을 수 있다", async () => {
    state.values = [];
    const r = await appendToLedger(ROWS, {
      sentOn: "2026-08-19",
      confirmedBy: "박수정",
    });
    expect(r.ok).toBe(false);
    expect(state.patched).toHaveLength(0);
  });
});
