import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend, mockAdmin, mockMark } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockAdmin: vi.fn(),
  mockMark: vi.fn(),
}));
vi.mock("@/lib/microsoft/sendmail", () => ({ sendGraphMail: mockSend }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockAdmin }));
vi.mock("../sheet-write", () => ({ markEmailErrorY: mockMark }));

import { sendSmileEdiMails } from "../mail-actions";
import type { SmileEdiGroup } from "../types";

function row() {
  return {
    excelRow: 2,
    writeDate: "2026-06-01",
    item: "품목",
    supplyAmount: "1000",
    taxAmount: "100",
    companyName: "A사",
    receiverDept: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    supplierManager: "",
    approvalNumber: "",
    emailError: "",
    status: "미승인",
  };
}

const group: SmileEdiGroup = {
  managerName: "홍길동",
  recipientEmail: "hong@jinhakapply.com",
  rows: [row()],
  routedByDefault: false,
};

const sheetMeta = { worksheetName: "Sheet1", emailErrorColIdx: 5 };

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({ ok: true, messageId: "m1" });
  mockMark.mockResolvedValue({ ok: true });
  mockAdmin.mockReturnValue({
    from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })),
  });
});

describe("sendSmileEdiMails", () => {
  it("발신자를 담당자 본인 메일박스(recipientEmail)로 발송", async () => {
    await sendSmileEdiMails([group], sheetMeta, {
      dryRun: false,
      fiscalYearStart: "2026-01-01",
      cc: [],
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const arg = mockSend.mock.calls[0][0];
    expect(arg.senderUserId).toBe("hong@jinhakapply.com");
    expect(arg.toEmail).toBe("hong@jinhakapply.com");
  });

  it("dryRun이면 발송하지 않고 이력만 적재", async () => {
    await sendSmileEdiMails([group], sheetMeta, {
      dryRun: true,
      fiscalYearStart: "2026-01-01",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });
});
