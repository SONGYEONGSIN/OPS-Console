import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetCurrentOperator,
  mockSendGraphMail,
  mockRenderPdf,
  mockGetById,
  mockAdminInsert,
  mockAdminUpdate,
  mockAdminFromOps,
  mockAdminOpsSelect,
} = vi.hoisted(() => ({
  mockGetCurrentOperator: vi.fn(),
  mockSendGraphMail: vi.fn(),
  mockRenderPdf: vi.fn(),
  mockGetById: vi.fn(),
  mockAdminInsert: vi.fn(),
  mockAdminUpdate: vi.fn(),
  mockAdminFromOps: vi.fn(),
  mockAdminOpsSelect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));

vi.mock("@/lib/microsoft/sendmail", () => ({
  sendGraphMail: mockSendGraphMail,
}));

vi.mock("@/lib/pdf/backup-request-pdf", () => ({
  renderBackupRequestPdf: mockRenderPdf,
}));

vi.mock("../queries", () => ({
  getBackupRequestById: mockGetById,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "operators") {
        return {
          select: mockAdminOpsSelect,
        };
      }
      if (table === "backup_request_mail_sends") {
        return { insert: mockAdminInsert };
      }
      if (table === "backup_requests") {
        return {
          update: () => ({
            eq: mockAdminUpdate,
          }),
        };
      }
      mockAdminFromOps(table);
      return {};
    },
  })),
}));

import { sendBackupRequestMail } from "../mail-actions";

const requester = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "bob@example.com",
  team: "ops",
  displayName: "Bob",
  permission: "member",
};

const backupRow = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  requester_email: "bob@example.com",
  requester_team: "ops",
  substitute_email: "alice@example.com",
  substitute_name: "Alice",
  services_detail: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      service_id: 5072006,
      service_name: "서비스1",
      university_name: "한양대학교",
      substitute_email: null,
      substitute_name: null,
      contacts: [
        {
          contact_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          customer_name: "양라윤",
          university_name: "한양대",
          email: null,
          phone: null,
        },
      ],
      note_md: "서비스1 메모",
    },
  ],
  summary_md: "내용",
  leave_start_date: "2026-05-20",
  leave_end_date: "2026-05-25",
  mail_status: "pending",
  mail_sent_at: null,
  mail_error: null,
  created_at: "2026-05-13T00:00:00Z",
  updated_at: "2026-05-13T00:00:00Z",
};

const teamMates = [
  { email: "carol@example.com", display_name: "Carol", team: "ops" },
  { email: "dave@example.com", display_name: "Dave", team: "ops" },
];

beforeEach(() => {
  mockGetCurrentOperator.mockReset();
  mockSendGraphMail.mockReset();
  mockRenderPdf.mockReset();
  mockGetById.mockReset();
  mockAdminInsert.mockReset();
  mockAdminUpdate.mockReset();
  mockAdminOpsSelect.mockReset();

  mockRenderPdf.mockResolvedValue(Buffer.from("fake-pdf-content".repeat(100)));
  mockAdminInsert.mockResolvedValue({ data: null, error: null });
  mockAdminUpdate.mockResolvedValue({ data: null, error: null });
  // operators select chain: .eq("team", x).neq("email", a).neq("email", b)
  const opsBuilder: Record<string, unknown> = {};
  opsBuilder.eq = () => opsBuilder;
  opsBuilder.neq = () => opsBuilder;
  opsBuilder.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve({ data: teamMates, error: null }).then(onFulfilled);
  mockAdminOpsSelect.mockReturnValue(opsBuilder);
});

describe("sendBackupRequestMail", () => {
  it("dry_run 모드 — sendGraphMail 호출 안 함 + 이력 status=dry_run", async () => {
    process.env.MAIL_DRY_RUN = "true";
    mockGetCurrentOperator.mockResolvedValue(requester);
    mockGetById.mockResolvedValue(backupRow);

    const r = await sendBackupRequestMail({ backup_request_id: backupRow.id });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe("dry_run");
    expect(mockSendGraphMail).not.toHaveBeenCalled();
    expect(mockAdminInsert).toHaveBeenCalled();
    const insertRow = mockAdminInsert.mock.calls[0][0];
    expect(insertRow.status).toBe("dry_run");
    delete process.env.MAIL_DRY_RUN;
  });

  it("정상 발송 — CC = 같은 team operators (requester/substitute 제외)", async () => {
    process.env.MAIL_DRY_RUN = "false";
    mockGetCurrentOperator.mockResolvedValue(requester);
    mockGetById.mockResolvedValue(backupRow);
    mockSendGraphMail.mockResolvedValue({ ok: true, messageId: "msg-1" });

    const r = await sendBackupRequestMail({ backup_request_id: backupRow.id });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe("sent");
    const call = mockSendGraphMail.mock.calls[0][0];
    expect(call.toEmail).toBe("alice@example.com");
    expect(call.cc).toBeDefined();
    expect(call.cc).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: "carol@example.com" }),
        expect.objectContaining({ email: "dave@example.com" }),
      ]),
    );
    // 숨은 참조(BCC) = 운영 감사용 고정 수신자 3명
    expect(call.bcc).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: "jiwu@jinhakapply.com" }),
        expect.objectContaining({ email: "wndms0815@jinhakapply.com" }),
        expect.objectContaining({ email: "kangsooji486@jinhakapply.com" }),
      ]),
    );
    expect(call.attachments).toBeDefined();
    expect(call.attachments[0].name).toMatch(/\.pdf$/);
    delete process.env.MAIL_DRY_RUN;
  });

  it("발송 실패 — mail_failed 적재 + ok:false", async () => {
    process.env.MAIL_DRY_RUN = "false";
    mockGetCurrentOperator.mockResolvedValue(requester);
    mockGetById.mockResolvedValue(backupRow);
    mockSendGraphMail.mockResolvedValue({ ok: false, error: "graph_500: x" });

    const r = await sendBackupRequestMail({ backup_request_id: backupRow.id });

    expect(r.ok).toBe(false);
    const insertRow = mockAdminInsert.mock.calls[0][0];
    expect(insertRow.status).toBe("failed");
    delete process.env.MAIL_DRY_RUN;
  });

  it("비인증 → ok:false", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);

    const r = await sendBackupRequestMail({ backup_request_id: backupRow.id });

    expect(r.ok).toBe(false);
    expect(mockSendGraphMail).not.toHaveBeenCalled();
  });

  it("backup_request not found → ok:false", async () => {
    mockGetCurrentOperator.mockResolvedValue(requester);
    mockGetById.mockResolvedValue(null);

    const r = await sendBackupRequestMail({
      backup_request_id: "00000000-0000-0000-0000-000000000000",
    });

    expect(r.ok).toBe(false);
    expect(mockSendGraphMail).not.toHaveBeenCalled();
  });

  it("PR-4: 백업자 2명 → sendGraphMail 2회, 각 본문에 자기 서비스의 contacts/note_md만", async () => {
    process.env.MAIL_DRY_RUN = "false";
    mockGetCurrentOperator.mockResolvedValue(requester);
    mockGetById.mockResolvedValue({
      ...backupRow,
      services_detail: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          service_id: 5072006,
          service_name: "신입학",
          university_name: "경찰대학",
          substitute_email: "kim@example.com",
          substitute_name: "Kim",
          contacts: [
            {
              contact_id: "11aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              customer_name: "강민호",
              university_name: "경찰대",
              email: "kmh@police.ac.kr",
              phone: "010-1111-2222",
            },
          ],
          note_md: "5/20 마감",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          service_id: 1165060,
          service_name: "외국인전형",
          university_name: "연세대학교",
          substitute_email: "park@example.com",
          substitute_name: "Park",
          contacts: [
            {
              contact_id: "22bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              customer_name: "박지호",
              university_name: "연세대",
              email: null,
              phone: null,
            },
          ],
          note_md: "양식 첨부",
        },
      ],
    });
    mockSendGraphMail.mockResolvedValue({ ok: true, messageId: "m" });

    const r = await sendBackupRequestMail({ backup_request_id: backupRow.id });

    expect(r.ok).toBe(true);
    expect(mockSendGraphMail).toHaveBeenCalledTimes(2);
    const call1 = mockSendGraphMail.mock.calls[0][0];
    const call2 = mockSendGraphMail.mock.calls[1][0];
    // 첫 그룹(Kim)의 본문에 자기 contact/note 만, Park 것은 없음
    const kimCall = call1.toEmail === "kim@example.com" ? call1 : call2;
    const parkCall = call1.toEmail === "park@example.com" ? call1 : call2;
    expect(kimCall.html).toContain("경찰대 — 강민호");
    expect(kimCall.html).toContain("5/20 마감");
    expect(kimCall.html).not.toContain("연세대 — 박지호");
    expect(kimCall.html).not.toContain("양식 첨부");
    expect(parkCall.html).toContain("연세대 — 박지호");
    expect(parkCall.html).toContain("양식 첨부");
    expect(parkCall.html).not.toContain("경찰대 — 강민호");
    delete process.env.MAIL_DRY_RUN;
  });
});
