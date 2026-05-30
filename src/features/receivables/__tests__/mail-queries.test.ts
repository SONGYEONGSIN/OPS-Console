import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../queries", () => ({
  fetchReceivablesSheet: vi.fn(),
}));

import { fetchReceivablesSheet } from "../queries";
import {
  previewReminderRecipients,
  findGroupForEmail,
} from "../mail-queries";

// 경과일수는 청구일자 기준으로 계산되므로 결정적 테스트를 위해 기준 시각 주입.
// NOW(늦은 시각)에선 픽스처의 모든 청구일자가 충분히 경과(>=10일).
const NOW = new Date("2026-06-01T12:00:00+09:00");

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe("previewReminderRecipients", () => {
  it("sheet null → groups []  + excluded에 sheet_unavailable", async () => {
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce(null);

    const r = await previewReminderRecipients();
    expect(r.groups).toEqual([]);
    expect(r.thresholdDays).toBe(10);
  });

  it("MAIL_REMINDER_THRESHOLD_DAYS 환경변수 미설정 → 기본 10일", async () => {
    delete process.env.MAIL_REMINDER_THRESHOLD_DAYS;
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce({
      worksheetName: "S",
      metaRows: [],
      headers: ["청구일자", "거래처명", "청구금액", "경과일수", "학교담당자"],
      rows: [["2026-04-01", "A학교", 1_000_000, 12, "ok@x.com"]],
      rowsText: [["2026-04-01", "A학교", "1,000,000", "12", "ok@x.com"]],
      validColIdx: [0, 1, 2, 3, 4],
      headerRowNumber: 1,
      rowCount: 2,
      columnCount: 5,
      fetchedAt: "2026-05-11T00:00:00Z",
    });

    const r = await previewReminderRecipients(NOW);
    expect(r.thresholdDays).toBe(10);
    expect(r.groups).toHaveLength(1);
  });

  it("threshold ENV 값을 적용", async () => {
    process.env.MAIL_REMINDER_THRESHOLD_DAYS = "20";
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce({
      worksheetName: "S",
      metaRows: [],
      headers: ["청구일자", "거래처명", "청구금액", "경과일수", "학교담당자"],
      rows: [
        ["2026-04-01", "A학교", 1_000_000, 15, "a@x.com"],
        ["2026-03-15", "B학교", 500_000, 25, "b@x.com"],
      ],
      rowsText: [
        ["2026-04-01", "A학교", "1,000,000", "15", "a@x.com"],
        ["2026-03-15", "B학교", "500,000", "25", "b@x.com"],
      ],
      validColIdx: [0, 1, 2, 3, 4],
      headerRowNumber: 1,
      rowCount: 3,
      columnCount: 5,
      fetchedAt: "2026-05-11T00:00:00Z",
    });

    const r = await previewReminderRecipients(new Date("2026-04-15T12:00:00+09:00"));
    expect(r.thresholdDays).toBe(20);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].recipient.email).toBe("b@x.com");
  });
});

describe("findGroupForEmail", () => {
  it("sheet null → group=null + sheetAvailable=false", async () => {
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce(null);
    const r = await findGroupForEmail("a@x.com");
    expect(r.group).toBeNull();
    expect(r.sheetAvailable).toBe(false);
  });

  it("같은 이메일 여러 행 → 모두 묶인 그룹 반환", async () => {
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce({
      worksheetName: "S",
      metaRows: [],
      headers: ["청구일자", "거래처명", "청구금액", "경과일수", "학교담당자"],
      rows: [
        ["2026-04-01", "A학교", 1_000_000, 12, "same@x.com"],
        ["2026-04-15", "A학교 분교", 500_000, 11, "same@x.com"],
        ["2026-04-20", "B학교", 700_000, 11, "other@x.com"],
      ],
      rowsText: [
        ["2026-04-01", "A학교", "1,000,000", "12", "same@x.com"],
        ["2026-04-15", "A학교 분교", "500,000", "11", "same@x.com"],
        ["2026-04-20", "B학교", "700,000", "11", "other@x.com"],
      ],
      validColIdx: [0, 1, 2, 3, 4],
      headerRowNumber: 1,
      rowCount: 4,
      columnCount: 5,
      fetchedAt: "2026-05-11T00:00:00Z",
    });

    const r = await findGroupForEmail("same@x.com", NOW);
    expect(r.group).not.toBeNull();
    expect(r.group!.items).toHaveLength(2);
    expect(r.group!.totalAmount).toBe(1_500_000);
  });

  it("이메일 대소문자 무시 매칭", async () => {
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce({
      worksheetName: "S",
      metaRows: [],
      headers: ["청구일자", "거래처명", "청구금액", "경과일수", "학교담당자"],
      rows: [["2026-04-01", "A학교", 1_000_000, 12, "Ok@X.com"]],
      rowsText: [["2026-04-01", "A학교", "1,000,000", "12", "Ok@X.com"]],
      validColIdx: [0, 1, 2, 3, 4],
      headerRowNumber: 1,
      rowCount: 2,
      columnCount: 5,
      fetchedAt: "2026-05-11T00:00:00Z",
    });

    const r = await findGroupForEmail("ok@x.com", NOW);
    expect(r.group).not.toBeNull();
  });

  it("매칭 없으면 group=null", async () => {
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce({
      worksheetName: "S",
      metaRows: [],
      headers: ["청구일자", "거래처명", "청구금액", "경과일수", "학교담당자"],
      rows: [["2026-04-01", "A학교", 1_000_000, 12, "found@x.com"]],
      rowsText: [["2026-04-01", "A학교", "1,000,000", "12", "found@x.com"]],
      validColIdx: [0, 1, 2, 3, 4],
      headerRowNumber: 1,
      rowCount: 2,
      columnCount: 5,
      fetchedAt: "2026-05-11T00:00:00Z",
    });

    const r = await findGroupForEmail("absent@x.com", NOW);
    expect(r.group).toBeNull();
  });
});
