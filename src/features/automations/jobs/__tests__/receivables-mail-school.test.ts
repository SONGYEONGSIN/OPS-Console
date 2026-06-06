import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  fetchSheetMock,
  groupMock,
  sendMock,
  fetchHolidaysMock,
} = vi.hoisted(() => ({
  fetchSheetMock: vi.fn(),
  groupMock: vi.fn(),
  sendMock: vi.fn(),
  fetchHolidaysMock: vi.fn(),
}));

vi.mock("@/features/receivables/queries", () => ({
  fetchReceivablesSheet: fetchSheetMock,
}));
vi.mock("@/features/receivables/school-mail-grouping", () => ({
  groupSchoolByOperator: groupMock,
}));
vi.mock("@/features/receivables/school-mail-actions", () => ({
  sendSchoolReminders: sendMock,
}));
vi.mock("@/lib/holidays/google-ical", () => ({
  fetchKoreanHolidays: fetchHolidaysMock,
}));

import { runReceivablesMailSchool } from "../receivables-mail-school";

const sheetStub = { worksheetName: "S", headers: [], validColIdx: [] };

beforeEach(() => {
  fetchSheetMock.mockReset();
  groupMock.mockReset();
  sendMock.mockReset();
  fetchHolidaysMock.mockResolvedValue([]);
  process.env.MAIL_DRY_RUN = "true";
});

describe("runReceivablesMailSchool", () => {
  it("주말이면 발송 안 함", async () => {
    // 2026-06-07 = 일요일
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T10:00:00+09:00"));
    const r = await runReceivablesMailSchool();
    vi.useRealTimers();
    expect(r.ok).toBe(true);
    expect(r.message).toContain("주말");
    expect(fetchSheetMock).not.toHaveBeenCalled();
  });

  it("대상 그룹 없으면 발송 대상 없음", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T10:00:00+09:00")); // 수
    fetchSheetMock.mockResolvedValue(sheetStub);
    groupMock.mockReturnValue({ groups: [], excluded: [] });
    const r = await runReceivablesMailSchool();
    vi.useRealTimers();
    expect(r.ok).toBe(true);
    expect(r.message).toContain("발송 대상 없음");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("그룹 있으면 sendSchoolReminders 호출 + 결과 요약", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T10:00:00+09:00"));
    fetchSheetMock.mockResolvedValue(sheetStub);
    groupMock.mockReturnValue({
      groups: [{ sender: {}, recipient: {}, items: [{}], totalAmount: 1 }],
      excluded: [],
    });
    sendMock.mockResolvedValue({ sent: 0, failed: 0, dryRun: 1 });
    const r = await runReceivablesMailSchool();
    vi.useRealTimers();
    expect(sendMock).toHaveBeenCalled();
    expect(r.ok).toBe(true);
    expect(r.message).toContain("DRY-RUN");
  });
});
