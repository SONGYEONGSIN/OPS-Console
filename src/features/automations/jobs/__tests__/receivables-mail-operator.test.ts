import { describe, it, expect, vi, beforeEach } from "vitest";

const { fetchSheetMock, sendOperatorRemindersMock } = vi.hoisted(() => ({
  fetchSheetMock: vi.fn(),
  sendOperatorRemindersMock: vi.fn(),
}));

vi.mock("@/features/receivables/queries", () => ({
  fetchReceivablesSheet: fetchSheetMock,
}));

vi.mock("@/features/receivables/operator-mail-actions", () => ({
  sendOperatorReminders: sendOperatorRemindersMock,
}));

import { runReceivablesMailOperator } from "../receivables-mail-operator";

beforeEach(() => {
  fetchSheetMock.mockReset();
  sendOperatorRemindersMock.mockReset();
});

describe("runReceivablesMailOperator", () => {
  it("sheet fetch 실패(null) → ok:false + 사유 메시지", async () => {
    fetchSheetMock.mockResolvedValue(null);
    const result = await runReceivablesMailOperator();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/시트|sheet/i);
    expect(sendOperatorRemindersMock).not.toHaveBeenCalled();
  });

  it("sheet OK + groups 0 → ok:true + 발송 대상 없음 메시지", async () => {
    fetchSheetMock.mockResolvedValue({
      worksheetName: "test",
      metaRows: [],
      headers: ["거래처명", "운영자", "청구금액", "청구일자", "적요"],
      rows: [],
      rowsText: [],
      validColIdx: [0, 1, 2, 3, 4],
      headerRowNumber: 1,
      rowCount: 0,
      columnCount: 5,
      fetchedAt: new Date().toISOString(),
    });
    const result = await runReceivablesMailOperator();
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/대상|없음/);
    expect(sendOperatorRemindersMock).not.toHaveBeenCalled();
  });

  it("sheet OK + groups 2 → sendOperatorReminders 호출 + 결과 message에 sent/failed/dryRun 카운트", async () => {
    fetchSheetMock.mockResolvedValue({
      worksheetName: "test",
      metaRows: [],
      headers: ["거래처명", "운영자", "청구금액", "청구일자", "적요"],
      rows: [
        ["가천대", "김슬기", 100000, "2020-01-01", ""],
        ["고려대", "정윤나", 50000, "2020-01-01", ""],
      ],
      rowsText: [
        ["가천대", "김슬기", "100000", "2020-01-01", ""],
        ["고려대", "정윤나", "50000", "2020-01-01", ""],
      ],
      validColIdx: [0, 1, 2, 3, 4],
      headerRowNumber: 1,
      rowCount: 2,
      columnCount: 5,
      fetchedAt: new Date().toISOString(),
    });
    sendOperatorRemindersMock.mockResolvedValue({
      sent: 2,
      failed: 0,
      dryRun: 0,
      results: [],
    });
    const result = await runReceivablesMailOperator();
    expect(result.ok).toBe(true);
    expect(sendOperatorRemindersMock).toHaveBeenCalledOnce();
    expect(result.message).toMatch(/2/);
    expect(result.details).toEqual(
      expect.objectContaining({ sent: 2, failed: 0, dryRun: 0 }),
    );
  });
});
