import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { fetchSheetMock, sendOperatorRemindersMock, fetchHolidaysMock } =
  vi.hoisted(() => ({
    fetchSheetMock: vi.fn(),
    sendOperatorRemindersMock: vi.fn(),
    fetchHolidaysMock: vi.fn(),
  }));

vi.mock("@/features/receivables/queries", () => ({
  fetchReceivablesSheet: fetchSheetMock,
}));
vi.mock("@/features/receivables/operator-mail-actions", () => ({
  sendOperatorReminders: sendOperatorRemindersMock,
}));
vi.mock("@/lib/holidays/google-ical", () => ({
  fetchKoreanHolidays: fetchHolidaysMock,
}));

import { runReceivablesMailOperator } from "../receivables-mail-operator";

// 평일(수) 고정 — 주말/공휴일 게이트 통과 + 마일스톤 계산 기준
const WEEKDAY = new Date("2026-06-03T10:00:00+09:00");

function makeSheet(rows: (string | number)[][]) {
  return {
    worksheetName: "test",
    metaRows: [],
    headers: ["거래처명", "운영자", "청구금액", "청구일자", "적요"],
    rows: rows.map((r) => [...r]),
    rowsText: rows.map((r) => r.map((c) => String(c))),
    validColIdx: [0, 1, 2, 3, 4],
    headerRowNumber: 1,
    rowCount: rows.length,
    columnCount: 5,
    fetchedAt: "2026-06-03T00:00:00Z",
  };
}

beforeEach(() => {
  fetchSheetMock.mockReset();
  sendOperatorRemindersMock.mockReset();
  fetchHolidaysMock.mockReset().mockResolvedValue([]);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(WEEKDAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runReceivablesMailOperator", () => {
  it("주말이면 발송 안 함 (skip)", async () => {
    vi.setSystemTime(new Date("2026-05-30T10:00:00+09:00")); // 토요일
    const result = await runReceivablesMailOperator();
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/주말|공휴일|발송 안 함/);
    expect(fetchSheetMock).not.toHaveBeenCalled();
    expect(sendOperatorRemindersMock).not.toHaveBeenCalled();
  });

  it("공휴일이면 발송 안 함 (skip)", async () => {
    fetchHolidaysMock.mockResolvedValue([{ date: "2026-06-03", title: "임시공휴일" }]);
    const result = await runReceivablesMailOperator();
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/주말|공휴일|발송 안 함/);
    expect(sendOperatorRemindersMock).not.toHaveBeenCalled();
  });

  it("sheet fetch 실패(null) → ok:false + 사유 메시지", async () => {
    fetchSheetMock.mockResolvedValue(null);
    const result = await runReceivablesMailOperator();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/시트|sheet/i);
    expect(sendOperatorRemindersMock).not.toHaveBeenCalled();
  });

  it("groups 0 → ok:true + 발송 대상 없음 메시지", async () => {
    fetchSheetMock.mockResolvedValue(makeSheet([]));
    const result = await runReceivablesMailOperator();
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/대상|없음/);
    expect(sendOperatorRemindersMock).not.toHaveBeenCalled();
  });

  it("마일스톤(경과 10일) 도달 건 → sendOperatorReminders 호출", async () => {
    // 2026-05-24 청구 → 2026-06-03 기준 정확히 10일(마일스톤)
    fetchSheetMock.mockResolvedValue(
      makeSheet([
        ["가천대", "김슬기", 100000, "2026-05-24", ""],
        ["고려대", "정윤나", 50000, "2026-05-24", ""],
      ]),
    );
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
  });

  it("마일스톤 사이(경과 12일) 건은 발송 대상 아님", async () => {
    // 2026-05-22 청구 → 12일 (TARGET_DAYS 아님)
    fetchSheetMock.mockResolvedValue(
      makeSheet([["가천대", "김슬기", 100000, "2026-05-22", ""]]),
    );
    const result = await runReceivablesMailOperator();
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/대상|없음/);
    expect(sendOperatorRemindersMock).not.toHaveBeenCalled();
  });
});
