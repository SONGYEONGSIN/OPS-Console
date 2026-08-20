import { describe, it, expect, vi, beforeEach } from "vitest";

const state = { ok: true, webUrl: "https://sp/x.xlsx", throws: false };

vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: () => {
    if (state.throws) throw new Error("token");
    return Promise.resolve("tok");
  },
}));

vi.stubGlobal(
  "fetch",
  vi.fn(async () => ({
    ok: state.ok,
    status: state.ok ? 200 : 404,
    json: async () => ({ webUrl: state.webUrl }),
  })),
);

const { getPostalWorkbookLinks } = await import("../workbook-links");

/**
 * 원본 엑셀 바로가기.
 *
 * 미수채권이 이미 같은 것을 하고 있다 — 링크 조회에 실패한 항목은 **아예 그리지
 * 않는다**(깨진 링크를 누르게 하지 않는다). 같은 규칙을 따른다.
 */
describe("getPostalWorkbookLinks", () => {
  beforeEach(() => {
    state.ok = true;
    state.webUrl = "https://sp/x.xlsx";
    state.throws = false;
    process.env.SHAREPOINT_DRIVE_ID = "d";
    process.env.SHAREPOINT_MAIL_ITEM_ID = "mail";
    process.env.SHAREPOINT_PETTY_CASH_ITEM_ID = "petty";
  });

  it("등기대장·전도금대장 링크를 준다", async () => {
    const r = await getPostalWorkbookLinks();
    expect(r.ledgerUrl).toBe("https://sp/x.xlsx");
    expect(r.pettyCashUrl).toBe("https://sp/x.xlsx");
  });

  it("조회가 실패하면 null — 버튼을 안 그리게 한다", async () => {
    state.ok = false;
    const r = await getPostalWorkbookLinks();
    expect(r.ledgerUrl).toBeNull();
    expect(r.pettyCashUrl).toBeNull();
  });

  it("설정이 없으면 null — 화면은 떠야 한다", async () => {
    delete process.env.SHAREPOINT_DRIVE_ID;
    const r = await getPostalWorkbookLinks();
    expect(r).toEqual({ ledgerUrl: null, pettyCashUrl: null });
  });

  it("토큰을 못 받아도 던지지 않는다 — 목록까지 죽으면 안 된다", async () => {
    state.throws = true;
    await expect(getPostalWorkbookLinks()).resolves.toEqual({
      ledgerUrl: null,
      pettyCashUrl: null,
    });
  });
});
