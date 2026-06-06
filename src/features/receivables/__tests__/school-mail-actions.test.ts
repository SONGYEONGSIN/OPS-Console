import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReceivablesSheet } from "../queries";
import type { SchoolReminderGroup } from "../school-mail-grouping";

const sendGraphMail = vi.fn();
const patchSingleColumn = vi.fn().mockResolvedValue({ ok: true });
const insertMock = vi.fn().mockResolvedValue({});
const inMock = vi.fn().mockResolvedValue({ data: [] });

vi.mock("@/lib/microsoft/sendmail", () => ({
  sendGraphMail: (...a: unknown[]) => sendGraphMail(...a),
}));
vi.mock("../sheet-write", () => ({
  patchSingleColumn: (...a: unknown[]) => patchSingleColumn(...a),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ in: inMock }),
      insert: insertMock,
    }),
  }),
}));

import { sendSchoolReminders } from "../school-mail-actions";

function sheet(): ReceivablesSheet {
  return {
    worksheetName: "Sheet1",
    metaRows: [],
    headers: ["청구일자", "학교담당자", "메일발송일자"],
    rows: [],
    rowsText: [],
    validColIdx: [0, 1, 2],
    headerRowNumber: 1,
    rowCount: 1,
    columnCount: 3,
    fetchedAt: "2026-06-07T00:00:00Z",
  };
}

const group: SchoolReminderGroup = {
  sender: { name: "송영신", email: "ys1114@jinhakapply.com" },
  recipient: { email: "a@x.com" },
  items: [
    {
      customerName: "A학교",
      invoiceDate: "2026-05-20",
      description: "원서",
      daysOverdue: 10,
      amount: 1_000_000,
      operatorLabel: "송영신",
      excelRow: 2,
    },
  ],
  totalAmount: 1_000_000,
};

beforeEach(() => {
  sendGraphMail.mockReset();
  patchSingleColumn.mockClear();
  insertMock.mockClear();
});

describe("sendSchoolReminders", () => {
  it("dryRun — Graph/PATCH 호출 없이 dry_run 이력만", async () => {
    const r = await sendSchoolReminders([group], sheet(), { dryRun: true });
    expect(r).toMatchObject({ sent: 0, failed: 0, dryRun: 1 });
    expect(sendGraphMail).not.toHaveBeenCalled();
    expect(patchSingleColumn).not.toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("실발송 성공 → 운영자 메일박스 발신 + 메일발송일자 PATCH", async () => {
    sendGraphMail.mockResolvedValue({ ok: true, messageId: "m1" });
    const r = await sendSchoolReminders([group], sheet(), { dryRun: false });
    expect(r).toMatchObject({ sent: 1, failed: 0 });
    expect(sendGraphMail).toHaveBeenCalledWith(
      expect.objectContaining({
        senderUserId: "ys1114@jinhakapply.com",
        toEmail: "a@x.com",
      }),
    );
    expect(patchSingleColumn).toHaveBeenCalledWith(
      expect.objectContaining({ colIdx: 2, rowNumbers: [2] }),
    );
  });

  it("발송 실패 → PATCH 안 함", async () => {
    sendGraphMail.mockResolvedValue({ ok: false, error: "boom" });
    const r = await sendSchoolReminders([group], sheet(), { dryRun: false });
    expect(r).toMatchObject({ sent: 0, failed: 1 });
    expect(patchSingleColumn).not.toHaveBeenCalled();
  });
});
