import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../queries", () => ({
  fetchReceivablesSheet: vi.fn(),
}));

import { fetchReceivablesSheet } from "../queries";
import { previewReminderRecipients, findGroupForEmail } from "../mail-queries";

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

/** 운영자 컬럼을 포함한 시트 — 수동 발송 그룹화(groupOwnerByOperator)가 요구 */
function sheetWithOperator(rows: (string | number)[][]) {
  return {
    worksheetName: "S",
    metaRows: [],
    headers: ["청구일자", "거래처명", "청구금액", "운영자", "학교담당자"],
    rows: rows.map((r) => [...r]),
    rowsText: rows.map((r) => r.map((c) => String(c))),
    validColIdx: [0, 1, 2, 3, 4],
    headerRowNumber: 1,
    rowCount: rows.length + 1,
    columnCount: 5,
    fetchedAt: "2026-05-30T00:00:00Z",
  };
}

describe("findGroupForEmail", () => {
  it("sheet null → groups=[] + sheetAvailable=false", async () => {
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce(null);
    const r = await findGroupForEmail("a@x.com");
    expect(r.groups).toEqual([]);
    expect(r.blocked).toEqual([]);
    expect(r.sheetAvailable).toBe(false);
  });

  it("같은 담당자 · 운영자 2명 → 운영자별 2 그룹", async () => {
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce(
      sheetWithOperator([
        ["2026-05-22", "A학교", 1_000_000, "송영신", "same@x.com"], // 10일
        ["2026-05-17", "B학교", 500_000, "한효진", "same@x.com"], // 15일
      ]),
    );
    const r = await findGroupForEmail("same@x.com", NOW);
    expect(r.groups).toHaveLength(2);
    expect(r.groups.map((g) => g.sender.email).sort()).toEqual([
      "hhj@jinhakapply.com",
      "ys1114@jinhakapply.com",
    ]);
  });

  it("같은 담당자 · 같은 운영자 여러 행 → 1 그룹 병합", async () => {
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce(
      sheetWithOperator([
        ["2026-05-22", "A학교", 1_000_000, "송영신", "same@x.com"],
        ["2026-05-17", "A학교 분교", 500_000, "송영신", "same@x.com"],
        ["2026-05-12", "B학교", 700_000, "송영신", "other@x.com"],
      ]),
    );
    const r = await findGroupForEmail("same@x.com", NOW);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].items).toHaveLength(2);
    expect(r.groups[0].totalAmount).toBe(1_500_000);
  });

  it("이메일 대소문자 무시 매칭", async () => {
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce(
      sheetWithOperator([
        ["2026-05-22", "A학교", 1_000_000, "송영신", "Ok@X.com"],
      ]),
    );
    const r = await findGroupForEmail("ok@x.com", NOW);
    expect(r.groups).toHaveLength(1);
  });

  it("매칭 없으면 groups=[]", async () => {
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce(
      sheetWithOperator([
        ["2026-05-22", "A학교", 1_000_000, "송영신", "found@x.com"],
      ]),
    );
    const r = await findGroupForEmail("absent@x.com", NOW);
    expect(r.groups).toEqual([]);
  });

  it("운영자 매핑 실패 행은 blocked로 노출 — 매핑된 그룹은 그대로 발송 대상", async () => {
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce(
      sheetWithOperator([
        ["2026-05-22", "A학교", 1_000_000, "송영신", "same@x.com"],
        ["2026-05-17", "C학교", 700_000, "홍길둥", "same@x.com"], // 명단에 없음
      ]),
    );
    const r = await findGroupForEmail("same@x.com", NOW);
    expect(r.groups).toHaveLength(1);
    expect(r.blocked).toHaveLength(1);
    expect(r.blocked[0].reason).toBe("operator_email_not_mapped");
    expect(r.blocked[0].customerName).toBe("C학교");
  });

  it("다른 담당자의 blocked 행은 노출하지 않는다", async () => {
    vi.mocked(fetchReceivablesSheet).mockResolvedValueOnce(
      sheetWithOperator([
        ["2026-05-22", "A학교", 1_000_000, "송영신", "same@x.com"],
        ["2026-05-17", "C학교", 700_000, "홍길둥", "other@x.com"], // 다른 담당자
      ]),
    );
    const r = await findGroupForEmail("same@x.com", NOW);
    expect(r.groups).toHaveLength(1);
    expect(r.blocked).toEqual([]);
  });
});
