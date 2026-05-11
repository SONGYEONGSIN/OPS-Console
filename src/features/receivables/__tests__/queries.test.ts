import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: vi.fn(async () => "test-token"),
  __resetTokenCache: vi.fn(),
}));

vi.mock("@/lib/microsoft/workbook-session", () => ({
  getWorkbookSession: vi.fn(async () => "test-session-id"),
  refreshWorkbookSession: vi.fn(async () => "test-session-id"),
  __resetWorkbookSessionCache: vi.fn(),
}));

describe("fetchReceivablesSheet", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID = "drive-1";
    process.env.SHAREPOINT_RECEIVABLES_ITEM_ID = "item-1";
  });

  it("env 누락 시 null 반환", async () => {
    delete process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID;
    const { fetchReceivablesSheet } = await import("../queries");
    expect(await fetchReceivablesSheet()).toBeNull();
  });

  it("worksheets + usedRange 성공 → headers/rows 반환", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [{ name: "Sheet1" }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            values: [
              ["대학", "건수", "금액"],
              ["서울대", 3, 1500000],
              ["연세대", 2, 980000],
            ],
            rowCount: 3,
            columnCount: 3,
            address: "A1:C3",
          }),
        }),
    );
    const { fetchReceivablesSheet } = await import("../queries");
    const data = await fetchReceivablesSheet();
    expect(data?.worksheetName).toBe("Sheet1");
    expect(data?.headers).toEqual(["대학", "건수", "금액"]);
    expect(data?.metaRows).toEqual([]);
    expect(data?.rows).toHaveLength(2);
    expect(data?.rows[0]).toEqual(["서울대", 3, 1500000]);
  });

  it("메타 행 위에 헤더 자동 감지 + 줄바꿈 헤더 정리", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [{ name: "Sheet1" }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            values: [
              ["[기준일_2026년 5월 6일]", "", "", "", 46153, 16],
              ["㈜진학어플라이 매출채권", 46148, "", "", "", ""],
              ["청구일자", "거래처명", "운영\n자", "청구금액", "메일발송\n일자", "입금여부"],
              ["2026-05-06", "서울대", "송영신", 987000, "2026-05-08", "미수"],
              ["2026-05-06", "연세대", "박지연", 135000, "2026-05-08", "수금"],
            ],
            rowCount: 5,
            columnCount: 6,
            address: "A1:F5",
          }),
        }),
    );
    const { fetchReceivablesSheet } = await import("../queries");
    const data = await fetchReceivablesSheet();
    expect(data?.metaRows).toHaveLength(2);
    expect(data?.headers).toEqual([
      "청구일자",
      "거래처명",
      "운영 자",
      "청구금액",
      "메일발송 일자",
      "입금여부",
    ]);
    expect(data?.rows).toHaveLength(2);
  });

  it("worksheets API 실패 → null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "unauthorized",
      }),
    );
    const { fetchReceivablesSheet } = await import("../queries");
    expect(await fetchReceivablesSheet()).toBeNull();
  });

  it("워크시트 없음 → null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      }),
    );
    const { fetchReceivablesSheet } = await import("../queries");
    expect(await fetchReceivablesSheet()).toBeNull();
  });
});
