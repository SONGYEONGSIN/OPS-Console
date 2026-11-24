import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetCurrentOperator,
  mockSendGraphMail,
  mockRenderPdf,
  mockGetById,
  mockAdminInsert,
  mockAdminOpsSelect,
  mockLoadIncidentCc,
} = vi.hoisted(() => ({
  mockLoadIncidentCc: vi.fn(),
  mockGetCurrentOperator: vi.fn(),
  mockSendGraphMail: vi.fn(),
  mockRenderPdf: vi.fn(),
  mockGetById: vi.fn(),
  mockAdminInsert: vi.fn(),
  mockAdminOpsSelect: vi.fn(),
}));

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));

vi.mock("@/lib/microsoft/sendmail", () => ({
  sendGraphMail: mockSendGraphMail,
}));

vi.mock("@/lib/pdf/incident-pdf", () => ({
  renderIncidentPdf: mockRenderPdf,
}));

vi.mock("../queries", () => ({
  getIncidentById: mockGetById,
}));

vi.mock("../cc-queries", () => ({
  loadIncidentCc: mockLoadIncidentCc,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "operators") {
        return { select: mockAdminOpsSelect };
      }
      if (table === "incident_mail_sends") {
        return { insert: mockAdminInsert };
      }
      return {};
    },
  })),
}));

import { sendIncidentMail } from "../mail-actions";

const me = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "ys1114@jinhakapply.com",
  displayName: "송영신",
  team: "운영2팀",
  permission: "member" as const,
};

const incident = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  year: 2026,
  university_name: "한양대학교",
  app_type: "공통원서",
  category: "결제 오류",
  occurred_date: "2026-05-20",
  resolved_date: "2026-05-21",
  title: "결제 페이지 문구 오안내",
  cause_summary: "결제 페이지 안내 문구 오류",
  root_cause: "QA 누락",
  resolution: "핫픽스 배포",
  prevention: "QA 체크리스트 보강",
  department: "운영부-운영1팀",
  assignee_email: "ys1114@jinhakapply.com",
  assignee_name: "송영신",
  reporter_email: "alcure23@jinhakapply.com",
  reporter_name: "허승철",
  status: "처리완료",
  created_at: "2026-05-27T00:00:00Z",
  updated_at: "2026-05-27T00:00:00Z",
};

beforeEach(() => {
  mockGetCurrentOperator.mockReset();
  mockSendGraphMail.mockReset();
  mockRenderPdf.mockReset();
  mockGetById.mockReset();
  mockAdminInsert.mockReset();
  mockAdminOpsSelect.mockReset();
  mockAdminInsert.mockResolvedValue({ data: null, error: null });
  mockAdminOpsSelect.mockReturnValue({
    eq: () => ({
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: me.id }, error: null }),
    }),
  });
  mockRenderPdf.mockResolvedValue(Buffer.from("pdf-bytes"));
  mockLoadIncidentCc.mockReset();
  mockLoadIncidentCc.mockResolvedValue({ cc: [], note: null });
  delete process.env.MAIL_DRY_RUN;
});

describe("sendIncidentMail — 인증 실패", () => {
  it("로그인 없으면 error", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const result = await sendIncidentMail({ incidentId: incident.id });
    expect(result.ok).toBe(false);
    expect(mockSendGraphMail).not.toHaveBeenCalled();
  });
});

describe("sendIncidentMail — 사고 미발견", () => {
  it("incident가 없으면 error", async () => {
    mockGetCurrentOperator.mockResolvedValue(me);
    mockGetById.mockResolvedValue(null);
    const result = await sendIncidentMail({ incidentId: "non-existent" });
    expect(result.ok).toBe(false);
    expect(mockSendGraphMail).not.toHaveBeenCalled();
  });
});

describe("sendIncidentMail — MAIL_DRY_RUN=true", () => {
  it("Graph 호출 없이 dry_run 이력만 적재", async () => {
    process.env.MAIL_DRY_RUN = "true";
    mockGetCurrentOperator.mockResolvedValue(me);
    mockGetById.mockResolvedValue(incident);

    const result = await sendIncidentMail({ incidentId: incident.id });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe("dry_run");
    expect(mockSendGraphMail).not.toHaveBeenCalled();
    expect(mockAdminInsert).toHaveBeenCalledTimes(1);
    const insertArg = mockAdminInsert.mock.calls[0][0];
    expect(insertArg.status).toBe("dry_run");
    expect(insertArg.recipient_email).toBe("alcure23@jinhakapply.com");
    expect(insertArg.incident_id).toBe(incident.id);
  });
});

describe("sendIncidentMail — 정상 발송", () => {
  it("Graph 호출 성공 시 sent 이력 적재", async () => {
    mockGetCurrentOperator.mockResolvedValue(me);
    mockGetById.mockResolvedValue(incident);
    mockSendGraphMail.mockResolvedValue({ ok: true, messageId: "msg-123" });

    const result = await sendIncidentMail({ incidentId: incident.id });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe("sent");
    expect(mockSendGraphMail).toHaveBeenCalledTimes(1);
    const sendArgs = mockSendGraphMail.mock.calls[0][0];
    expect(sendArgs.senderUserId).toBe(me.email);
    expect(sendArgs.toEmail).toBe("alcure23@jinhakapply.com");
    expect(sendArgs.subject).toContain("[운영부 상황실]");
    expect(sendArgs.attachments).toHaveLength(1);
    expect(sendArgs.attachments[0].contentType).toBe("application/pdf");

    expect(mockAdminInsert).toHaveBeenCalledTimes(1);
    const insertArg = mockAdminInsert.mock.calls[0][0];
    expect(insertArg.status).toBe("sent");
    expect(insertArg.graph_message_id).toBe("msg-123");
    expect(insertArg.recipient_email).toBe("alcure23@jinhakapply.com");
  });
});

describe("sendIncidentMail — Graph 실패", () => {
  it("sendGraphMail 실패 시 failed 이력 적재 + error 반환", async () => {
    mockGetCurrentOperator.mockResolvedValue(me);
    mockGetById.mockResolvedValue(incident);
    mockSendGraphMail.mockResolvedValue({
      ok: false,
      error: "unauthorized: bad token",
    });

    const result = await sendIncidentMail({ incidentId: incident.id });

    expect(result.ok).toBe(false);
    expect(mockAdminInsert).toHaveBeenCalledTimes(1);
    const insertArg = mockAdminInsert.mock.calls[0][0];
    expect(insertArg.status).toBe("failed");
    expect(insertArg.error_message).toContain("unauthorized");
    expect(insertArg.graph_message_id).toBeNull();
  });
});

describe("sendIncidentMail — 4년제 참조(이사님·영업자)", () => {
  it("참조 대상을 대학·보고자로 찾아 CC 로 보낸다", async () => {
    mockGetCurrentOperator.mockResolvedValue(me);
    mockGetById.mockResolvedValue(incident);
    mockSendGraphMail.mockResolvedValue({ ok: true, messageId: "m" });
    mockLoadIncidentCc.mockResolvedValue({
      cc: [
        { email: "llh@jinhak.com", name: "이이화" },
        { email: "sales@jinhakapply.com", name: "윤영호" },
      ],
      note: null,
    });

    const result = await sendIncidentMail({ incidentId: incident.id });

    expect(mockLoadIncidentCc).toHaveBeenCalledWith(
      "한양대학교",
      "alcure23@jinhakapply.com",
    );
    expect(mockSendGraphMail.mock.calls[0][0].cc).toEqual([
      { email: "llh@jinhak.com", name: "이이화" },
      { email: "sales@jinhakapply.com", name: "윤영호" },
    ]);
    expect(result).toMatchObject({
      ok: true,
      cc: ["llh@jinhak.com", "sales@jinhakapply.com"],
    });
  });

  it("참조가 없으면 cc 를 안 넘긴다(받는 사람만)", async () => {
    mockGetCurrentOperator.mockResolvedValue(me);
    mockGetById.mockResolvedValue(incident);
    mockSendGraphMail.mockResolvedValue({ ok: true, messageId: "m" });

    await sendIncidentMail({ incidentId: incident.id });

    expect(mockSendGraphMail.mock.calls[0][0].cc).toBeUndefined();
  });

  it("참조를 못 채운 사정(note)을 결과로 돌려준다 — 활동 로그에 남긴다", async () => {
    mockGetCurrentOperator.mockResolvedValue(me);
    mockGetById.mockResolvedValue(incident);
    mockSendGraphMail.mockResolvedValue({ ok: true, messageId: "m" });
    mockLoadIncidentCc.mockResolvedValue({
      cc: [{ email: "llh@jinhak.com", name: "이이화" }],
      note: "영업자 김은호 — 조직권한 영업팀에 없음",
    });

    const result = await sendIncidentMail({ incidentId: incident.id });

    expect(result).toMatchObject({
      ok: true,
      ccNote: "영업자 김은호 — 조직권한 영업팀에 없음",
    });
  });

  it("dry_run 에도 참조를 계산해 돌려준다", async () => {
    process.env.MAIL_DRY_RUN = "true";
    mockGetCurrentOperator.mockResolvedValue(me);
    mockGetById.mockResolvedValue(incident);
    mockLoadIncidentCc.mockResolvedValue({
      cc: [{ email: "llh@jinhak.com", name: "이이화" }],
      note: null,
    });

    const result = await sendIncidentMail({ incidentId: incident.id });

    expect(result).toMatchObject({ ok: true, status: "dry_run", cc: ["llh@jinhak.com"] });
  });
});
