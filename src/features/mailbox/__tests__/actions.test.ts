import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAdmin, mockGetOperator, mockSendGraphMail } = vi.hoisted(() => ({
  mockAdmin: vi.fn(),
  mockGetOperator: vi.fn(),
  mockSendGraphMail: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockAdmin }));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetOperator,
}));
vi.mock("@/lib/microsoft/sendmail", () => ({
  sendGraphMail: mockSendGraphMail,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/worklog/log", () => ({ logActivity: vi.fn() }));

import { sendMailReply, setAutoDraftEnabled } from "../actions";

/** message_id로 owner/from/subject join 조회 → 결과를 반환하는 가짜 admin client */
function makeAdmin(message: Record<string, unknown> | null) {
  const draftInsert = vi.fn().mockResolvedValue({ error: null });
  const settingsUpsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table === "mailbox_messages") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: message, error: null }),
          }),
        }),
      };
    }
    if (table === "operators") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                name: "송영신",
                department: "운영부",
                team: "운영2팀",
                role: "팀장",
                phone: "(02)2013-0669",
              },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "mailbox_drafts") return { insert: draftInsert };
    if (table === "mailbox_settings") return { upsert: settingsUpsert };
    throw new Error("unexpected table " + table);
  });
  return { client: { from }, draftInsert, settingsUpsert };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOperator.mockResolvedValue({ permission: "member", email: "op@x.com" });
});

describe("sendMailReply", () => {
  const msg = {
    id: "11111111-1111-4111-8111-111111111111",
    owner_email: "op@x.com",
    from_email: "kim@u.ac.kr",
    from_name: "김민수",
    subject: "견적 문의",
  };

  it("빈 본문 거부 (zod issues[0].message)", async () => {
    const r = await sendMailReply("11111111-1111-4111-8111-111111111111", "");
    expect(r.ok).toBe(false);
  });

  it("본인 메일함이 아니면 권한 거부", async () => {
    mockGetOperator.mockResolvedValue({ permission: "member", email: "other@x.com" });
    const { client } = makeAdmin(msg);
    mockAdmin.mockReturnValue(client);
    const r = await sendMailReply(msg.id, "회신");
    expect(r.ok).toBe(false);
  });

  it("정상 발송 — sendGraphMail(sender=owner_email) 호출 + draft status='sent'", async () => {
    const { client, draftInsert } = makeAdmin(msg);
    mockAdmin.mockReturnValue(client);
    mockSendGraphMail.mockResolvedValue({ ok: true });
    const r = await sendMailReply(msg.id, "회신드립니다.");
    expect(r.ok).toBe(true);
    expect(mockSendGraphMail).toHaveBeenCalledWith(
      expect.objectContaining({
        senderUserId: "op@x.com",
        toEmail: "kim@u.ac.kr",
        html: expect.stringContaining("회신드립니다."),
      }),
    );
    // HTML 발송이므로 text 인자는 넘기지 않는다.
    expect(mockSendGraphMail.mock.calls[0][0]).not.toHaveProperty("text");
    // 클릭 가능 서명 링크가 본문에 포함된다.
    expect(mockSendGraphMail.mock.calls[0][0].html).toContain(
      '<a href="https://www.jinhakapply.com/">원서접수</a>',
    );
    expect(draftInsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({ status: "sent", sent_by_email: "op@x.com" }),
    );
  });

  it("MAIL_DRY_RUN=true 시 sendGraphMail 미호출 + status='dry_run'", async () => {
    vi.stubEnv("MAIL_DRY_RUN", "true");
    const { client, draftInsert } = makeAdmin(msg);
    mockAdmin.mockReturnValue(client);
    const r = await sendMailReply(msg.id, "회신");
    expect(r.ok).toBe(true);
    expect(mockSendGraphMail).not.toHaveBeenCalled();
    expect(draftInsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({ status: "dry_run" }),
    );
    vi.unstubAllEnvs();
  });
});

describe("setAutoDraftEnabled", () => {
  it("settings upsert 호출", async () => {
    const { client, settingsUpsert } = makeAdmin(null);
    mockAdmin.mockReturnValue(client);
    const r = await setAutoDraftEnabled("op@x.com", false);
    expect(r.ok).toBe(true);
    expect(settingsUpsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({ owner_email: "op@x.com", auto_draft_enabled: false }),
    );
  });
});
