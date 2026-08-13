import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetGraphToken } = vi.hoisted(() => ({
  mockGetGraphToken: vi.fn(),
}));

vi.mock("@/lib/microsoft/auth", () => ({ getGraphToken: mockGetGraphToken }));

import { getReceivablesWorkbookLinks } from "../workbook-links";

const OK = (webUrl: string) =>
  ({ ok: true, json: async () => ({ webUrl }) }) as unknown as Response;
const FAIL = (status: number) =>
  ({ ok: false, status, json: async () => ({}) }) as unknown as Response;

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  mockGetGraphToken.mockResolvedValue("tok");
  process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID = "drive-1";
  process.env.SHAREPOINT_RECEIVABLES_ITEM_ID = "ledger-1";
  process.env.SHAREPOINT_DEPOSIT_ITEM_ID = "deposit-1";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getReceivablesWorkbookLinks", () => {
  it("두 워크북의 webUrl을 돌려준다", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
      Promise.resolve(
        String(input).includes("ledger-1")
          ? OK("https://sp/ledger.xlsx")
          : OK("https://sp/deposit.xlsx"),
      ),
    );
    await expect(getReceivablesWorkbookLinks()).resolves.toEqual({
      ledgerUrl: "https://sp/ledger.xlsx",
      depositUrl: "https://sp/deposit.xlsx",
    });
  });

  it("한쪽이 실패해도 다른 쪽 링크는 살린다", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
      Promise.resolve(
        String(input).includes("deposit-1")
          ? FAIL(404)
          : OK("https://sp/ledger.xlsx"),
      ),
    );
    await expect(getReceivablesWorkbookLinks()).resolves.toEqual({
      ledgerUrl: "https://sp/ledger.xlsx",
      depositUrl: null,
    });
  });

  it("drive_id가 없으면 Graph를 부르지 않고 둘 다 null", async () => {
    delete process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID;
    const spy = vi.spyOn(globalThis, "fetch");
    await expect(getReceivablesWorkbookLinks()).resolves.toEqual({
      ledgerUrl: null,
      depositUrl: null,
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("토큰 획득이 실패해도 던지지 않는다 — 화면은 떠야 한다", async () => {
    mockGetGraphToken.mockRejectedValue(new Error("auth down"));
    await expect(getReceivablesWorkbookLinks()).resolves.toEqual({
      ledgerUrl: null,
      depositUrl: null,
    });
  });

  it("item_id가 없으면 그 항목만 null", async () => {
    delete process.env.SHAREPOINT_DEPOSIT_ITEM_ID;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      OK("https://sp/ledger.xlsx"),
    );
    await expect(getReceivablesWorkbookLinks()).resolves.toEqual({
      ledgerUrl: "https://sp/ledger.xlsx",
      depositUrl: null,
    });
  });
});
