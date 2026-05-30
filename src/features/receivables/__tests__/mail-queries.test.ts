import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../queries", () => ({
  fetchReceivablesSheet: vi.fn(),
}));

import { fetchReceivablesSheet } from "../queries";
import {
  previewReminderRecipients,
  findGroupForEmail,
} from "../mail-queries";

// 경과일수는 청구일자 기준 계산. NOW=2026-06-01 기준:
// 2026-05-22→10일, 2026-05-17→15일, 2026-05-12→20일, 2026-05-07→25일 (모두 마일스톤)
const NOW = new Date("2026-06-01T12:00:00+09:00");

const ORIG_ENV = { ...process.env };

function sheet(rows: (string | number)[][]) {
  return {
    worksheetName: "S",
    metaRows: [],
    headers: ["청구일자", "거래처명", "청구금액", "학교담당자"],
    rows: rows.map((r) => [...r]),
    rowsText: rows.map((r) => r.map((c) => String(c))),
    validColIdx: [0, 1, 2, 3],
    headerRowNumber: 1,
    rowCount: rows.length + 1,
    columnCount: 4,
    fetchedAt: "2026-05-30T00:00:00Z",
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe("previewReminderRecipients", () => {
  it("sheet null → groups []  + thresholdDays 기본 10", async () => {
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce(null);
    const r = await previewReminderRecipients();
    expect(r.groups).toEqual([]);
    expect(r.thresholdDays).toBe(10);
  });

  it("경과 >= 10 행 1건 → 1 그룹", async () => {
    delete process.env.MAIL_REMINDER_THRESHOLD_DAYS;
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce(
      sheet([["2026-05-22", "A학교", 1_000_000, "ok@x.com"]]), // 10일
    );
    const r = await previewReminderRecipients(NOW);
    expect(r.thresholdDays).toBe(10);
    expect(r.groups).toHaveLength(1);
  });

  it("threshold ENV 값을 적용 (threshold 미만이면 제외)", async () => {
    process.env.MAIL_REMINDER_THRESHOLD_DAYS = "20";
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce(
      sheet([
        ["2026-05-17", "A학교", 1_000_000, "a@x.com"], // 15일 마일스톤, <20 → 제외
        ["2026-05-07", "B학교", 500_000, "b@x.com"], // 25일 마일스톤, >=20 → 포함
      ]),
    );
    const r = await previewReminderRecipients(NOW);
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
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce(
      sheet([
        ["2026-05-22", "A학교", 1_000_000, "same@x.com"], // 10일
        ["2026-05-17", "A학교 분교", 500_000, "same@x.com"], // 15일
        ["2026-05-12", "B학교", 700_000, "other@x.com"], // 20일
      ]),
    );
    const r = await findGroupForEmail("same@x.com", NOW);
    expect(r.group).not.toBeNull();
    expect(r.group!.items).toHaveLength(2);
    expect(r.group!.totalAmount).toBe(1_500_000);
  });

  it("이메일 대소문자 무시 매칭", async () => {
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce(
      sheet([["2026-05-22", "A학교", 1_000_000, "Ok@X.com"]]), // 10일
    );
    const r = await findGroupForEmail("ok@x.com", NOW);
    expect(r.group).not.toBeNull();
  });

  it("매칭 없으면 group=null", async () => {
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce(
      sheet([["2026-05-22", "A학교", 1_000_000, "found@x.com"]]),
    );
    const r = await findGroupForEmail("absent@x.com", NOW);
    expect(r.group).toBeNull();
  });
});
