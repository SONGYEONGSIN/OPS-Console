import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OperatorReminderGroup } from "../operator-mail-grouping";

const { sendGraphMailMock, adminInsertMock } = vi.hoisted(() => ({
  sendGraphMailMock: vi.fn(),
  adminInsertMock: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/microsoft/sendmail", () => ({
  sendGraphMail: sendGraphMailMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ insert: adminInsertMock }),
  }),
}));

import { sendOperatorReminders } from "../operator-mail-actions";

const baseGroup: OperatorReminderGroup = {
  operator: { name: "김슬기", email: "bluewhich87@jinhakapply.com" },
  items: [
    {
      customerName: "가천대",
      invoiceDate: "2026-04-10",
      description: "전형료 정산",
      daysOverdue: 30,
      amount: 100000,
      operatorLabel: "김슬기",
    },
  ],
  totalAmount: 100000,
};

describe("sendOperatorReminders", () => {
  beforeEach(() => {
    sendGraphMailMock.mockReset();
    adminInsertMock.mockClear();
  });

  it("dryRun=true → sendGraphMail 미호출 + 이력 status=dry_run insert", async () => {
    const result = await sendOperatorReminders([baseGroup], { dryRun: true });
    expect(sendGraphMailMock).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(1);
    expect(result.sent).toBe(0);
    expect(result.results[0].status).toBe("dry_run");
    expect(adminInsertMock).toHaveBeenCalledOnce();
    expect(adminInsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ status: "dry_run", recipient_email: baseGroup.operator.email }),
      ]),
    );
  });

  it("dryRun=false + Graph ok → status=sent + graph_message_id 적재", async () => {
    sendGraphMailMock.mockResolvedValue({ ok: true, messageId: "graph-msg-1" });
    const result = await sendOperatorReminders([baseGroup], { dryRun: false });
    expect(sendGraphMailMock).toHaveBeenCalledOnce();
    expect(sendGraphMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        senderUserId: baseGroup.operator.email,
        toEmail: baseGroup.operator.email,
      }),
    );
    expect(result.sent).toBe(1);
    expect(result.results[0].status).toBe("sent");
    expect(result.results[0].graphMessageId).toBe("graph-msg-1");
    expect(adminInsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ status: "sent", graph_message_id: "graph-msg-1" }),
      ]),
    );
  });

  it("dryRun=false + Graph 실패 → status=failed + errorMessage", async () => {
    sendGraphMailMock.mockResolvedValue({ ok: false, error: "Mail.Send permission denied" });
    const result = await sendOperatorReminders([baseGroup], { dryRun: false });
    expect(result.failed).toBe(1);
    expect(result.results[0].status).toBe("failed");
    expect(result.results[0].errorMessage).toBe("Mail.Send permission denied");
    expect(adminInsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ status: "failed", error_message: "Mail.Send permission denied" }),
      ]),
    );
  });

  it("group 빈 배열 → 호출 0, 카운트 모두 0, insert 안 함", async () => {
    const result = await sendOperatorReminders([], { dryRun: false });
    expect(sendGraphMailMock).not.toHaveBeenCalled();
    expect(adminInsertMock).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, failed: 0, dryRun: 0, results: [] });
  });
});
