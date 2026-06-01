import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireAdminMock,
  insertMatchAliasMock,
  fetchMatchAliasesMock,
  fetchReceivablesSheetMock,
  fetchDepositSheetMock,
  patchMatchResultMock,
  logActivityMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  insertMatchAliasMock: vi.fn().mockResolvedValue({ ok: true }),
  fetchMatchAliasesMock: vi.fn().mockResolvedValue({}),
  fetchReceivablesSheetMock: vi.fn(),
  fetchDepositSheetMock: vi.fn(),
  patchMatchResultMock: vi.fn().mockResolvedValue({ ok: true, dryRun: true }),
  logActivityMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/permission", () => ({ requireAdmin: requireAdminMock }));
vi.mock("../alias-queries", () => ({
  insertMatchAlias: insertMatchAliasMock,
  fetchMatchAliases: fetchMatchAliasesMock,
}));
vi.mock("@/features/receivables/queries", () => ({
  fetchReceivablesSheet: fetchReceivablesSheetMock,
}));
vi.mock("../deposit-queries", () => ({
  fetchDepositSheet: fetchDepositSheetMock,
}));
vi.mock("../patch", () => ({ patchMatchResult: patchMatchResultMock }));
vi.mock("@/features/worklog/log", () => ({ logActivity: logActivityMock }));

import { applyMismatchAsMatch } from "../apply-mismatch-action";

const sheet = {
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
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue({ email: "admin@x.com", permission: "admin" });
  insertMatchAliasMock.mockResolvedValue({ ok: true });
  patchMatchResultMock.mockResolvedValue({ ok: true, dryRun: true });
});

describe("applyMismatchAsMatch", () => {
  it("alias 학습(서강국제대학원→서강대) + 현재 시트 매칭 PATCH", async () => {
    fetchReceivablesSheetMock.mockResolvedValue(sheet);
    fetchDepositSheetMock.mockResolvedValue([
      { row: 1769, date: "2026-05-03", amount: 84000, content: "서강국제대학원", matchedFlag: "" },
    ]);
    fetchMatchAliasesMock.mockResolvedValue({ 서강국제대학원: "서강대" });

    const r = await applyMismatchAsMatch({
      misuRow: 2,
      depRow: 1769,
      misuCustomer: "서강대학교",
      depContent: "서강국제대학원",
    });

    expect(insertMatchAliasMock).toHaveBeenCalledWith(
      expect.objectContaining({ alias_key: "서강국제대학원", alias_value: "서강대", created_by: "admin@x.com" }),
    );
    expect(patchMatchResultMock).toHaveBeenCalled();
    const pairArg = patchMatchResultMock.mock.calls[0][0];
    expect(pairArg.depRows).toContain(1769);
    expect(r).toMatchObject({ ok: true, patched: true });
  });

  it("즉시 매칭 단계(시트 fetch)가 throw해도 학습은 유지 (ok, patched:false)", async () => {
    fetchReceivablesSheetMock.mockRejectedValue(new Error("graph 500"));
    fetchDepositSheetMock.mockResolvedValue([]);

    const r = await applyMismatchAsMatch({
      misuRow: 2, depRow: 1769, misuCustomer: "서강대학교", depContent: "서강국제대학원",
    });
    expect(insertMatchAliasMock).toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true, patched: false });
  });

  it("이미 입금완료 등으로 현재 매칭 안 되면 → 학습만(patched:false)", async () => {
    fetchReceivablesSheetMock.mockResolvedValue({
      ...sheet,
      rowsText: [["2026-05-01", "서강대학교", "김슬기", "84000", "30", "입금완료"]],
      rows: [["2026-05-01", "서강대학교", "김슬기", 84000, 30, "입금완료"]],
    });
    fetchDepositSheetMock.mockResolvedValue([
      { row: 1769, date: "2026-05-03", amount: 84000, content: "서강국제대학원", matchedFlag: "" },
    ]);
    fetchMatchAliasesMock.mockResolvedValue({ 서강국제대학원: "서강대" });

    const r = await applyMismatchAsMatch({
      misuRow: 2, depRow: 1769, misuCustomer: "서강대학교", depContent: "서강국제대학원",
    });
    expect(insertMatchAliasMock).toHaveBeenCalled();
    expect(patchMatchResultMock).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true, patched: false });
  });
});
