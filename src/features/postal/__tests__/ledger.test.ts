import { describe, it, expect, vi, beforeEach } from "vitest";
import { LEDGER_HEADERS } from "../ledger-parse";

const state = {
  sheets: ["2026년도 우편물발송(04월~)", "2025 우편물 담당자"],
  values: [] as unknown[][],
  items: [] as Record<string, unknown>[],
};

vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: () => Promise.resolve("tok"),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      Object.assign(chain, {
        select: () => Promise.resolve({ data: state.items, error: null }),
      });
      return chain;
    },
  }),
}));

vi.stubGlobal(
  "fetch",
  vi.fn().mockImplementation((url: string) => {
    if (String(url).includes("/worksheets?") || String(url).endsWith("/worksheets")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ value: state.sheets.map((name) => ({ name })) }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ values: state.values }),
    });
  }),
);

const { readLedger } = await import("../ledger");

/**
 * 대장 읽기.
 *
 * 시트 이름에 연도가 박혀 있어 **내년 4월이면 새 시트가 생긴다.** 첫 시트를 무턱대고
 * 읽으면 그때 조용히 작년 대장을 보여주게 된다.
 */
describe("readLedger", () => {
  beforeEach(() => {
    process.env.SHAREPOINT_DRIVE_ID = "d";
    process.env.SHAREPOINT_MAIL_ITEM_ID = "i";
    state.sheets = ["2026년도 우편물발송(04월~)", "2025 우편물 담당자"];
    state.values = [
      [...LEDGER_HEADERS],
      [1, 46252, "우석대학교", "강정화", "김지현", "박수정", "11263-1102-7080", ""],
      [2, 46252, "한림성심대학교", "김한솔", "김승현", "박수정", "11263-1102-7081", ""],
    ];
    state.items = [];
  });

  it("올해 시트를 읽는다", async () => {
    const r = await readLedger(2026);
    expect(r.sheetName).toBe("2026년도 우편물발송(04월~)");
    expect(r.rows).toHaveLength(2);
  });

  it("올해 시트가 없으면 멈추고 알린다 — 작년 대장을 올해로 보여주면 안 된다", async () => {
    state.sheets = ["2025년도 우편물발송(04월~)"];
    await expect(readLedger(2026)).rejects.toThrow(/2026/);
  });

  it("등기번호로 영수증을 잇는다 — 한 장에 여러 건이 찍힌다", async () => {
    state.items = [
      { tracking_no: "11263-1102-7080", receipt_id: "r1" },
      { tracking_no: "11263-1102-7081", receipt_id: "r1" },
    ];
    const r = await readLedger(2026);
    expect(r.rows[0].receiptId).toBe("r1");
    expect(r.rows[1].receiptId).toBe("r1");
  });

  it("증빙이 없는 행은 비운다 — 숨기지 않는다", async () => {
    const r = await readLedger(2026);
    expect(r.rows[0].receiptId).toBeNull();
  });
});
