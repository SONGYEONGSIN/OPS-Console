import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  fetchReceivablesSheetMock,
  fetchDepositSheetMock,
  patchMatchResultMock,
  sendMismatchReportMock,
  adminInsertMock,
} = vi.hoisted(() => ({
  fetchReceivablesSheetMock: vi.fn(),
  fetchDepositSheetMock: vi.fn(),
  patchMatchResultMock: vi.fn().mockResolvedValue({ ok: true, dryRun: false }),
  sendMismatchReportMock: vi.fn().mockResolvedValue({ ok: true, count: 0 }),
  adminInsertMock: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/features/receivables/queries", () => ({
  fetchReceivablesSheet: fetchReceivablesSheetMock,
}));
vi.mock("@/features/receivables-match/deposit-queries", () => ({
  fetchDepositSheet: fetchDepositSheetMock,
  depositFetchFailMessage: () => "SharePoint 입금내역 시트 fetch 실패",
}));
vi.mock("@/features/receivables-match/patch", () => ({
  patchMatchResult: patchMatchResultMock,
}));
vi.mock("@/features/receivables-match/mismatch-mail", () => ({
  sendMismatchReport: sendMismatchReportMock,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ insert: adminInsertMock }),
  }),
}));

import { runReceivablesDepositMatch } from "../receivables-deposit-match";

beforeEach(() => {
  fetchReceivablesSheetMock.mockReset();
  fetchDepositSheetMock.mockReset();
  patchMatchResultMock.mockClear();
  sendMismatchReportMock.mockClear();
  adminInsertMock.mockClear();
});

describe("runReceivablesDepositMatch", () => {
  it("미수 시트 fetch 실패 → ok:false + 사유 메시지", async () => {
    fetchReceivablesSheetMock.mockResolvedValue(null);
    const result = await runReceivablesDepositMatch();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/미수|sheet/i);
  });

  it("입금 시트 fetch 실패 → ok:false + 사유", async () => {
    fetchReceivablesSheetMock.mockResolvedValue({
      worksheetName: "미수",
      metaRows: [],
      headers: ["청구일자", "거래처명", "운영자", "청구금액", "경과일수", "적요"],
      rows: [],
      rowsText: [],
      validColIdx: [],
      headerRowNumber: 1,
      rowCount: 0,
      columnCount: 0,
      fetchedAt: new Date().toISOString(),
    });
    fetchDepositSheetMock.mockResolvedValue(null);
    const result = await runReceivablesDepositMatch();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/입금|deposit/i);
  });

  it("dryRun 모드 → patchMatchResult dryRun:true 호출 + 이력 mode=dry_run insert", async () => {
    process.env.MAIL_MATCH_DRY_RUN = "true";
    fetchReceivablesSheetMock.mockResolvedValue({
      worksheetName: "미수",
      metaRows: [],
      headers: ["청구일자", "거래처명", "운영자", "청구금액", "경과일수", "적요"],
      rows: [["2026-04-10", "가천대", "김슬기", 100000, 30, ""]],
      rowsText: [["2026-04-10", "가천대", "김슬기", "100000", "30", ""]],
      validColIdx: [0, 1, 2, 3, 4, 5],
      headerRowNumber: 1,
      rowCount: 1,
      columnCount: 6,
      fetchedAt: new Date().toISOString(),
    });
    fetchDepositSheetMock.mockResolvedValue([
      { row: 2, date: "2026-04-15", amount: 100000, content: "가천대", matchedFlag: "" },
    ]);

    const result = await runReceivablesDepositMatch();
    expect(result.ok).toBe(true);
    expect(patchMatchResultMock).toHaveBeenCalled();
    expect(patchMatchResultMock.mock.calls[0][3]).toEqual({ dryRun: true });
    expect(adminInsertMock).toHaveBeenCalledOnce();
    expect(adminInsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ mode: "dry_run", matched_count: 1 }),
      ]),
    );
  });
});
