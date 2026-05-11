import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: vi.fn(),
}));

vi.mock("@/lib/microsoft/sendmail", () => ({
  sendGraphMail: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { getCurrentOperator } from "@/features/auth/queries";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReminderEmails } from "../mail-actions";
import type { ReminderGroup } from "../mail-schemas";

const ORIG_ENV = { ...process.env };

const sampleGroup: ReminderGroup = {
  recipient: { email: "a@school.ac.kr", name: "김교사" },
  items: [
    {
      customerName: "A학교",
      invoiceDate: "2026-04-01",
      description: "원서 4월",
      daysOverdue: 12,
      amount: 1_000_000,
      operatorLabel: "송영신",
    },
  ],
  totalAmount: 1_000_000,
};

const validInput = {
  thresholdDays: 10,
  groups: [sampleGroup],
  dryRun: false,
};

function mockAdminInsert(): {
  insert: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
} {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn().mockReturnValue({ insert });
  vi.mocked(createAdminClient).mockReturnValue({
    from,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return { insert, from };
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.MAIL_COMPANY_NAME = "진학어플라이";
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe("sendReminderEmails — 권한", () => {
  it("viewer 거부 + sendGraphMail 호출 0회", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "v@x.com",
      displayName: "Viewer",
      permission: "viewer",
      operator: null,
      role: "",
      team: null,
      allowedMenus: [],
    });

    const r = await sendReminderEmails(validInput);
    expect(r.ok).toBe(false);
    expect(vi.mocked(sendGraphMail).mock.calls.length).toBe(0);
  });

  it("member 거부 (admin only)", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "m@x.com",
      displayName: "Member",
      permission: "member",
      operator: null,
      role: "",
      team: null,
      allowedMenus: [],
    });

    const r = await sendReminderEmails(validInput);
    expect(r.ok).toBe(false);
    expect(vi.mocked(sendGraphMail).mock.calls.length).toBe(0);
  });

  it("로그인 안 됨 (null) 거부", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue(null);
    const r = await sendReminderEmails(validInput);
    expect(r.ok).toBe(false);
    expect(vi.mocked(sendGraphMail).mock.calls.length).toBe(0);
  });
});

describe("sendReminderEmails — admin", () => {
  function mockAdmin() {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "admin@x.com",
      displayName: "Admin K",
      permission: "admin",
      operator: null,
      role: "",
      team: null,
      allowedMenus: [],
    });
  }

  it("dryRun=true → sendGraphMail 호출 0회 + insert status=dry_run", async () => {
    mockAdmin();
    const { insert, from } = mockAdminInsert();

    const r = await sendReminderEmails({ ...validInput, dryRun: true });
    expect(r.ok).toBe(true);
    expect(vi.mocked(sendGraphMail).mock.calls.length).toBe(0);
    expect(from).toHaveBeenCalledWith("receivables_mail_sends");
    expect(insert).toHaveBeenCalled();
    const inserted = insert.mock.calls[0][0];
    const row = Array.isArray(inserted) ? inserted[0] : inserted;
    expect(row.status).toBe("dry_run");
    expect(row.recipient_email).toBe("a@school.ac.kr");
  });

  it("dryRun=false + Graph 200 → sendGraphMail 그룹 수만큼 호출 + insert status=sent", async () => {
    mockAdmin();
    vi.mocked(sendGraphMail).mockResolvedValue({
      ok: true,
      messageId: "msg-1",
    });
    const { insert } = mockAdminInsert();

    const r = await sendReminderEmails({ ...validInput, dryRun: false });
    expect(r.ok).toBe(true);
    expect(vi.mocked(sendGraphMail).mock.calls.length).toBe(1);
    const sendArgs = vi.mocked(sendGraphMail).mock.calls[0][0];
    expect(sendArgs.toEmail).toBe("a@school.ac.kr");
    expect(sendArgs.senderUserId).toBe("admin@x.com");
    expect(insert).toHaveBeenCalled();
    const row = insert.mock.calls[0][0];
    const inserted = Array.isArray(row) ? row[0] : row;
    expect(inserted.status).toBe("sent");
    expect(inserted.graph_message_id).toBe("msg-1");
  });

  it("Graph 실패 → insert status=failed + error_message 기록", async () => {
    mockAdmin();
    vi.mocked(sendGraphMail).mockResolvedValue({
      ok: false,
      error: "unauthorized: token denied",
    });
    const { insert } = mockAdminInsert();

    const r = await sendReminderEmails({ ...validInput, dryRun: false });
    expect(r.ok).toBe(true); // 전체 결과는 ok — 그룹별 status 개별 기록
    const row = insert.mock.calls[0][0];
    const inserted = Array.isArray(row) ? row[0] : row;
    expect(inserted.status).toBe("failed");
    expect(inserted.error_message).toContain("unauthorized");
  });
});

describe("sendReminderEmails — 입력 검증", () => {
  it("zod parse 실패 (groups 빈 배열) 거부", async () => {
    const r = await sendReminderEmails({
      thresholdDays: 10,
      groups: [],
      dryRun: false,
    });
    expect(r.ok).toBe(false);
  });
});
