import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  fetchReceivablesSheetMock,
  fetchDepositSheetMock,
  patchMatchResultMock,
  sendMismatchReportMock,
  adminInsertMock,
  fetchMatchAliasesMock,
  writeUnpaidSchoolsMock,
} = vi.hoisted(() => ({
  fetchReceivablesSheetMock: vi.fn(),
  fetchDepositSheetMock: vi.fn(),
  patchMatchResultMock: vi.fn().mockResolvedValue({ ok: true, dryRun: false }),
  sendMismatchReportMock: vi.fn().mockResolvedValue({ ok: true, count: 0 }),
  adminInsertMock: vi.fn().mockResolvedValue({ error: null }),
  fetchMatchAliasesMock: vi.fn().mockResolvedValue({}),
  writeUnpaidSchoolsMock: vi.fn().mockResolvedValue({ ok: true, written: true }),
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
vi.mock("@/features/receivables-match/unpaid-schools-write", () => ({
  writeUnpaidSchools: writeUnpaidSchoolsMock,
}));

import { runReceivablesDepositMatch } from "../receivables-deposit-match";

beforeEach(() => {
  // **시각을 고정한다.** 09시에는 잡이 스스로 건너뛰므로(Graph 몰림 회피),
  // 고정하지 않으면 그 시간대에 돌린 테스트가 통째로 깨진다(2026-09-03).
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-03T05:00:00Z")); // KST 14:00
  fetchReceivablesSheetMock.mockReset();
  fetchDepositSheetMock.mockReset();
  patchMatchResultMock.mockClear();
  sendMismatchReportMock.mockClear();
  adminInsertMock.mockClear();
  fetchMatchAliasesMock.mockReset();
  fetchMatchAliasesMock.mockResolvedValue({});
  writeUnpaidSchoolsMock.mockReset();
  writeUnpaidSchoolsMock.mockResolvedValue({ ok: true, written: true });

afterEach(() => {
  vi.useRealTimers();
});
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
    // 실행 이력 메시지는 한글 포맷(매칭 · 불일치 · 에러)
    expect(result.message).toContain("매칭 1 · 불일치 0 · 에러 0");
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
    // skip 메시지에 거래처명 + 금액 표시 (행번호 대신 가독성)
    expect(insertArg.payload.skips[0]).toContain("가천대");
    expect(insertArg.payload.skips[0]).toContain("100,000");
  });

  it("09시에는 건너뛴다 — 시트를 읽지도 않는다", async () => {
    // Graph 가 몰리는 시각이라 아예 시작하지 않는다(2026-09-01~03 실패 37%).
    vi.setSystemTime(new Date("2026-09-03T00:00:00Z")); // KST 09:00
    const r = await runReceivablesDepositMatch();
    expect(r.skipped).toBe(true);
    expect(r.ok).toBe(true); // 실패가 아니라 안 한 것이다
    expect(fetchReceivablesSheetMock).not.toHaveBeenCalled();
  });

  it("왜 안 도는지 메시지에 적는다", async () => {
    vi.setSystemTime(new Date("2026-09-03T00:00:00Z"));
    expect((await runReceivablesDepositMatch()).message).toContain("09시");
  });

  describe("입금내역 대장 V열 — 미수 학교 목록", () => {
    // 가천대는 입금과 매칭돼 입금완료가 되고, 나대학만 계속 미수다.
    function arrangeTwoSchools() {
      fetchReceivablesSheetMock.mockResolvedValue({
        worksheetName: "미수",
        metaRows: [],
        headers: ["청구일자", "거래처명", "운영자", "청구금액", "경과일수", "적요"],
        rows: [
          ["2026-04-10", "가천대", "김슬기", 100000, 30, ""],
          ["2026-04-11", "나대학", "김슬기", 50000, 30, ""],
        ],
        rowsText: [
          ["2026-04-10", "가천대", "김슬기", "100000", "30", ""],
          ["2026-04-11", "나대학", "김슬기", "50000", "30", ""],
        ],
        validColIdx: [0, 1, 2, 3, 4, 5],
        headerRowNumber: 1,
        rowCount: 2,
        columnCount: 6,
        fetchedAt: new Date().toISOString(),
      });
      fetchDepositSheetMock.mockResolvedValue([
        { row: 2, date: "2026-04-15", amount: 100000, content: "가천대", matchedFlag: "" },
      ]);
      patchMatchResultMock.mockResolvedValue({ ok: true, dryRun: false });
    }

    it("dry-run 이면 쓰지 않고 학교 수만 남긴다", async () => {
      process.env.MAIL_MATCH_DRY_RUN = "true";
      arrangeTwoSchools();
      const result = await runReceivablesDepositMatch();
      expect(writeUnpaidSchoolsMock).not.toHaveBeenCalled();
      expect(result.message).toContain(" · 미수 학교 1곳");
      expect(result.details?.unpaidSchools).toBe(1);
      const insertArg = adminInsertMock.mock.calls[0][0][0];
      expect(insertArg.payload.unpaidSchools).toBe(1);
      expect(result.details?.unpaidSchoolsWritten).toBe(false);
    });

    it("live 이면 방금 매칭된 학교를 뺀 목록을 쓴다", async () => {
      process.env.MAIL_MATCH_DRY_RUN = "false";
      arrangeTwoSchools();
      const result = await runReceivablesDepositMatch();
      expect(writeUnpaidSchoolsMock).toHaveBeenCalledTimes(1);
      expect(writeUnpaidSchoolsMock.mock.calls[0][0]).toEqual(["나대학"]);
      expect(writeUnpaidSchoolsMock.mock.calls[0][1]).toBe("수수료입금내역조회");
      expect(result.ok).toBe(true);
      expect(result.message).toMatch(/ · 미수 학교 1곳$/);
      expect(result.details?.unpaidSchoolsWritten).toBe(true);
      const insertArg = adminInsertMock.mock.calls[0][0][0];
      expect(insertArg.payload.unpaidSchoolsWritten).toBe(true);
    });

    it("목록이 그대로라 쓰지 않았으면 이력에 written=false 로 남는다", async () => {
      process.env.MAIL_MATCH_DRY_RUN = "false";
      arrangeTwoSchools();
      writeUnpaidSchoolsMock.mockResolvedValue({ ok: true, written: false });
      const result = await runReceivablesDepositMatch();
      expect(result.ok).toBe(true);
      expect(result.details?.unpaidSchools).toBe(1);
      expect(result.details?.unpaidSchoolsWritten).toBe(false);
      const insertArg = adminInsertMock.mock.calls[0][0][0];
      expect(insertArg.payload.unpaidSchoolsWritten).toBe(false);
    });

    it("V열 쓰기가 실패해도 매칭 결과는 그대로고 errors 에 드러난다", async () => {
      process.env.MAIL_MATCH_DRY_RUN = "false";
      arrangeTwoSchools();
      writeUnpaidSchoolsMock.mockResolvedValue({ ok: false, errorMessage: "boom" });
      const result = await runReceivablesDepositMatch();
      expect(result.ok).toBe(false);
      expect(result.details?.matched).toBe(1);
      expect(result.details?.errors).toBe(1);
      const insertArg = adminInsertMock.mock.calls[0][0][0];
      expect(insertArg.matched_count).toBe(1);
      expect(insertArg.payload.errors).toEqual(["미수 학교 목록(V열): boom"]);
    });
  });
});
