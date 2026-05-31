import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendGraphMail, mockInsert, mockSelectResult } = vi.hoisted(() => ({
  mockSendGraphMail: vi.fn(),
  mockInsert: vi.fn(),
  mockSelectResult: { rows: [] as { recipient_email: string }[] },
}));

vi.mock("@/lib/microsoft/sendmail", () => ({ sendGraphMail: mockSendGraphMail }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => {
      const sel: Record<string, unknown> = {};
      sel.select = () => sel;
      sel.eq = () => sel;
      (sel as { then: unknown }).then = (r: (v: unknown) => unknown) =>
        r({ data: mockSelectResult.rows, error: null });
      sel.insert = mockInsert;
      return sel;
    },
  })),
}));

import { sendServiceNotices } from "../mail-actions";
import type { ServiceNoticeGroup } from "../schemas";

function grp(email: string): ServiceNoticeGroup {
  return {
    operator: { email, name: email.split("@")[0] },
    services: [
      {
        id: "1",
        universityName: "가천대",
        serviceName: "수시",
        universityType: "4년제",
        category: "공통원서",
        operatorEmail: email,
        operatorName: email.split("@")[0],
        writeStartAt: "2026-06-01T00:00:00Z",
        writeEndAt: null,
        payStartAt: null,
        payEndAt: null,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSelectResult.rows = [];
  mockInsert.mockResolvedValue({ error: null });
});

describe("sendServiceNotices", () => {
  it("dryRun — sendGraphMail 미호출, dryRun 카운트 + 이력 적재", async () => {
    const r = await sendServiceNotices([grp("a@x.com"), grp("b@x.com")], "2026-06", 6, {
      dryRun: true,
    });
    expect(mockSendGraphMail).not.toHaveBeenCalled();
    expect(r.dryRun).toBe(2);
    expect(r.sent).toBe(0);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("live — 단일 그룹 발송 성공", async () => {
    mockSendGraphMail.mockResolvedValue({ ok: true, messageId: "m1" });
    const r = await sendServiceNotices([grp("a@x.com")], "2026-06", 6, {
      dryRun: false,
    });
    expect(mockSendGraphMail).toHaveBeenCalledTimes(1);
    const arg = mockSendGraphMail.mock.calls[0][0];
    expect(arg.senderUserId).toBe("a@x.com");
    expect(arg.toEmail).toBe("a@x.com");
    expect(r.sent).toBe(1);
  });

  it("idempotency — 이번 달 이미 sent된 운영자는 skip", async () => {
    mockSelectResult.rows = [{ recipient_email: "a@x.com" }];
    mockSendGraphMail.mockResolvedValue({ ok: true, messageId: "m" });
    const r = await sendServiceNotices([grp("a@x.com"), grp("b@x.com")], "2026-06", 6, {
      dryRun: false,
    });
    expect(r.skipped).toBe(1);
    expect(r.sent).toBe(1);
    expect(mockSendGraphMail).toHaveBeenCalledTimes(1);
    expect(mockSendGraphMail.mock.calls[0][0].toEmail).toBe("b@x.com");
  });
});
