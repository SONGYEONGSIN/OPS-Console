import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  fetchReceivablesSheetMock,
  fetchDepositSheetMock,
  patchMatchResultMock,
  sendMismatchReportMock,
  adminInsertMock,
  fetchMatchAliasesMock,
} = vi.hoisted(() => ({
  fetchReceivablesSheetMock: vi.fn(),
  fetchDepositSheetMock: vi.fn(),
  patchMatchResultMock: vi.fn().mockResolvedValue({ ok: true, dryRun: false }),
  sendMismatchReportMock: vi.fn().mockResolvedValue({ ok: true, count: 0 }),
  adminInsertMock: vi.fn().mockResolvedValue({ error: null }),
  fetchMatchAliasesMock: vi.fn().mockResolvedValue({}),
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
vi.mock("@/features/receivables-match/alias-queries", () => ({
  fetchMatchAliases: fetchMatchAliasesMock,
}));

import { runReceivablesDepositMatch } from "../receivables-deposit-match";

beforeEach(() => {
  fetchReceivablesSheetMock.mockReset();
  fetchDepositSheetMock.mockReset();
  patchMatchResultMock.mockClear();
  sendMismatchReportMock.mockClear();
  adminInsertMock.mockClear();
  fetchMatchAliasesMock.mockReset();
  fetchMatchAliasesMock.mockResolvedValue({});
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

  it("학습된 alias를 로드해 mismatch를 자동 매칭한다", async () => {
    process.env.MAIL_MATCH_DRY_RUN = "true";
    fetchReceivablesSheetMock.mockResolvedValue({
      worksheetName: "미수",
      metaRows: [],
      headers: ["청구일자", "거래처명", "운영자", "청구금액", "경과일수", "적요"],
      rows: [["2026-05-01", "서강대학교", "김슬기", 84000, 30, ""]],
      rowsText: [["2026-05-01", "서강대학교", "김슬기", "84000", "30", ""]],
      validColIdx: [0, 1, 2, 3, 4, 5],
      headerRowNumber: 1,
      rowCount: 1,
      columnCount: 6,
      fetchedAt: new Date().toISOString(),
    });
    fetchDepositSheetMock.mockResolvedValue([
      { row: 1769, date: "2026-05-03", amount: 84000, content: "서강국제대학원", matchedFlag: "" },
    ]);
    // alias 미적용이면 mismatch — alias 로드 시 매칭
    fetchMatchAliasesMock.mockResolvedValue({ 서강국제대학원: "서강대" });

    const result = await runReceivablesDepositMatch();
    expect(result.ok).toBe(true);
    expect(result.details?.matched).toBe(1);
    expect(result.details?.mismatches).toBe(0);
    expect(fetchMatchAliasesMock).toHaveBeenCalled();
  });

  it("매칭 쌍이 이미 입금완료(race skip) → 에러 아님(ok:true), skips로 분류", async () => {
    process.env.MAIL_MATCH_DRY_RUN = "false";
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
    // 이미 입금완료 → patch가 skip 반환 (race guard)
    patchMatchResultMock.mockResolvedValue({ ok: false, skipped: true });

    const result = await runReceivablesDepositMatch();

    // race skip은 양성 — 에러로 세지 않으므로 ok:true, errors 0
    expect(result.ok).toBe(true);
    expect(result.details?.errors).toBe(0);

    // 이력: error_count 0, payload.skips 1건, matched_count(=successfulPatches) 0
    const insertArg = adminInsertMock.mock.calls[0][0][0];
    expect(insertArg.error_count).toBe(0);
    expect(insertArg.matched_count).toBe(0);
    expect(insertArg.payload.skips).toHaveLength(1);
    expect(insertArg.payload.errors).toHaveLength(0);
  });
});
