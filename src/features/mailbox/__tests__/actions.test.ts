import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAdmin, mockGetOperator, mockSendGraphMail, mockCanAccess } = vi.hoisted(() => ({
  mockAdmin: vi.fn(),
  mockGetOperator: vi.fn(),
  mockSendGraphMail: vi.fn(),
  mockCanAccess: vi.fn(),
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
vi.mock("../delegation", () => ({ canAccessMailbox: mockCanAccess }));

import {
  sendMailReply,
  setAutoDraftEnabled,
  ensureMailboxSettings,
  grantMailboxDelegation,
  revokeMailboxDelegation,
} from "../actions";

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
  mockCanAccess.mockResolvedValue(false);
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
    mockCanAccess.mockResolvedValue(false);
    const { client } = makeAdmin(msg);
    mockAdmin.mockReturnValue(client);
    const r = await sendMailReply(msg.id, "회신");
    expect(r.ok).toBe(false);
  });

  it("정상 발송 — sendGraphMail(sender=owner_email) 호출 + draft status='sent'", async () => {
    mockCanAccess.mockResolvedValue(true);
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
    mockCanAccess.mockResolvedValue(true);
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

  it("위임받은 B가 A 메일함 발송 허용 (canAccessMailbox=true)", async () => {
    mockGetOperator.mockResolvedValue({ permission: "member", email: "b@x.com" });
    mockCanAccess.mockResolvedValue(true);
    const { client } = makeAdmin(msg); // msg.owner_email = "op@x.com"
    mockAdmin.mockReturnValue(client);
    mockSendGraphMail.mockResolvedValue({ ok: true });
    const r = await sendMailReply(msg.id, "회신");
    expect(r.ok).toBe(true);
    // 발신 명의는 owner(op@x.com), 처리자는 b@x.com
    expect(mockSendGraphMail.mock.calls[0][0].senderUserId).toBe("op@x.com");
  });

  it("위임 없는 타인 발송 거부 (canAccessMailbox=false)", async () => {
    mockGetOperator.mockResolvedValue({ permission: "member", email: "c@x.com" });
    mockCanAccess.mockResolvedValue(false);
    const { client } = makeAdmin(msg);
    mockAdmin.mockReturnValue(client);
    const r = await sendMailReply(msg.id, "회신");
    expect(r.ok).toBe(false);
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

describe("ensureMailboxSettings", () => {
  it("본인 메일함 row를 auto_draft_enabled=false로 insert-if-absent (기존 토글 보존)", async () => {
    const { client, settingsUpsert } = makeAdmin(null);
    mockAdmin.mockReturnValue(client);
    const r = await ensureMailboxSettings("op@x.com");
    expect(r.ok).toBe(true);
    // 신규 등록은 자동초안 OFF 기본값
    expect(settingsUpsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({ owner_email: "op@x.com", auto_draft_enabled: false }),
    );
    // 기존 row가 있으면 덮어쓰지 않음 (ignoreDuplicates)
    expect(settingsUpsert.mock.calls[0][1]).toEqual(
      expect.objectContaining({ onConflict: "owner_email", ignoreDuplicates: true }),
    );
  });

  it("본인 메일함이 아니면 권한 거부", async () => {
    mockGetOperator.mockResolvedValue({ permission: "member", email: "other@x.com" });
    const { client } = makeAdmin(null);
    mockAdmin.mockReturnValue(client);
    const r = await ensureMailboxSettings("op@x.com");
    expect(r.ok).toBe(false);
  });
});

function makeDelegationAdmin() {
  const delegationUpsert = vi.fn().mockResolvedValue({ error: null });
  const operatorMaybe = vi.fn().mockResolvedValue({
    data: { email: "b@x.com" },
    error: null,
  });
  // revoke 체인: .update({...}).eq(col1,val1).eq(col2,val2)
  // eq2 — 두 번째 .eq(grantee_email, ...) 인자 캡처
  const eq2 = vi.fn().mockResolvedValue({ error: null });
  // eq1 — 첫 번째 .eq(owner_email, ...) 인자 캡처, eq2 반환
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const from = vi.fn((table: string) => {
    if (table === "operators") {
      return { select: () => ({ eq: () => ({ maybeSingle: operatorMaybe }) }) };
    }
    if (table === "mailbox_delegations") {
      return {
        upsert: delegationUpsert,
        update: vi.fn().mockReturnValue({ eq: eq1 }),
      };
    }
    throw new Error("unexpected table " + table);
  });
  return { client: { from }, delegationUpsert, operatorMaybe, eq1, eq2 };
}

describe("grantMailboxDelegation", () => {
  it("본인(owner=me) → B에게 위임 upsert(revoked_at=null)", async () => {
    const { client, delegationUpsert } = makeDelegationAdmin();
    mockAdmin.mockReturnValue(client);
    const r = await grantMailboxDelegation("b@x.com");
    expect(r.ok).toBe(true);
    expect(delegationUpsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        owner_email: "op@x.com",
        grantee_email: "b@x.com",
        revoked_at: null,
      }),
    );
    expect(delegationUpsert.mock.calls[0][1]).toEqual(
      expect.objectContaining({ onConflict: "owner_email,grantee_email" }),
    );
  });

  it("본인에게 위임 → 거부", async () => {
    const { client } = makeDelegationAdmin();
    mockAdmin.mockReturnValue(client);
    const r = await grantMailboxDelegation("op@x.com");
    expect(r.ok).toBe(false);
  });

  it("미존재 운영자 → 거부", async () => {
    const { client, operatorMaybe } = makeDelegationAdmin();
    operatorMaybe.mockResolvedValue({ data: null, error: null });
    mockAdmin.mockReturnValue(client);
    const r = await grantMailboxDelegation("ghost@x.com");
    expect(r.ok).toBe(false);
  });
});

describe("revokeMailboxDelegation", () => {
  it("owner_email=me, grantee_email=b@x.com 필터로 revoked_at update 호출", async () => {
    const { client, eq1, eq2 } = makeDelegationAdmin();
    mockAdmin.mockReturnValue(client);
    const r = await revokeMailboxDelegation("b@x.com");
    expect(r.ok).toBe(true);
    expect(eq1).toHaveBeenCalledWith("owner_email", "op@x.com");
    expect(eq2).toHaveBeenCalledWith("grantee_email", "b@x.com");
  });
});

describe("grantMailboxDelegation — operators 조회 DB에러", () => {
  it("operators 조회 error 시 ok:false + 에러 메시지 전달", async () => {
    const { client, operatorMaybe } = makeDelegationAdmin();
    operatorMaybe.mockResolvedValue({ data: null, error: { message: "boom" } });
    mockAdmin.mockReturnValue(client);
    const r = await grantMailboxDelegation("b@x.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("boom");
  });
});
