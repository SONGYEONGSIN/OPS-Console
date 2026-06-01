import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/auth/queries", () => ({ getCurrentOperator: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/microsoft/sendmail", () => ({ sendGraphMail: vi.fn() }));
vi.mock("@/lib/pdf/incident-report-pdf", () => ({
  renderIncidentReportPdf: vi.fn(async () => Buffer.from("%PDF-fake")),
}));
vi.mock("@/features/worklog/log", () => ({ logActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../sharepoint-register", () => ({
  registerIncidentReportToSharePoint: vi.fn(async () => null),
}));
vi.mock("@/lib/microsoft/delegated-token", () => ({
  getDelegatedGraphToken: vi.fn(async () => null),
}));

import { sendIncidentReport } from "../mail-actions";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { registerIncidentReportToSharePoint } from "../sharepoint-register";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.MAIL_DRY_RUN;
});

const REPORT_ID = crypto.randomUUID();

const APPROVED_REPORT = {
  id: REPORT_ID,
  title: "전산파일 오류 건",
  status: "approved",
  author_email: "me@x.com",
  author_name: "나",
  recipient_university: "건국대학교",
  draft_date: "2026-06-01",
  approver_name: null,
  director_name: null,
  ceo_name: null,
  doc_number: null,
  apology: null,
  gyeongwi: null,
  cause: null,
  handling: null,
  prevention: null,
};

/**
 * 체이닝 가능한 supabase admin mock 빌더.
 * - from("incident_reports").select().eq().maybeSingle() → report
 * - from("incident_reports").update().eq().select().single() → updated
 * - from("operators").select().eq().maybeSingle() → { id }
 * - from("incident_report_mail_sends").insert() → 캡처
 */
function buildAdminMock(report: Record<string, unknown> | null) {
  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      if (table === "incident_reports") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: report }) }),
          }),
          update: (patch: Record<string, unknown>) => {
            updates.push(patch);
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: report ? { ...report, ...patch } : null,
                  }),
                }),
              }),
            };
          },
        };
      }
      if (table === "operators") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { id: "op-1" } }) }),
          }),
        };
      }
      if (table === "incident_report_mail_sends") {
        return {
          insert: async (row: Record<string, unknown>) => {
            inserts.push(row);
            return { data: null, error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { client, inserts, updates };
}

describe("sendIncidentReport", () => {
  it("비로그인 → 에러", async () => {
    (getCurrentOperator as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const r = await sendIncidentReport({
      id: "22222222-2222-2222-2222-222222222222",
      recipient_emails: ["a@b.com"],
    });
    expect(r).toEqual({ ok: false, error: "로그인이 필요합니다." });
  });

  it("수신 이메일 없음 → 검증 에러", async () => {
    (getCurrentOperator as ReturnType<typeof vi.fn>).mockResolvedValue({
      email: "me@x.com",
      displayName: "나",
      permission: "member",
    });
    const r = await sendIncidentReport({
      id: "22222222-2222-2222-2222-222222222222",
      recipient_emails: [],
    });
    expect(r.ok).toBe(false);
  });

  it("승인 완료가 아니면 발송 불가", async () => {
    (getCurrentOperator as ReturnType<typeof vi.fn>).mockResolvedValue({
      email: "me@x.com",
      displayName: "나",
      permission: "member",
    });
    const { client } = buildAdminMock({ ...APPROVED_REPORT, status: "draft" });
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client);
    const r = await sendIncidentReport({
      id: APPROVED_REPORT.id,
      recipient_emails: ["a@b.com"],
    });
    expect(r).toEqual({ ok: false, error: "승인 완료된 경위서만 발송할 수 있습니다." });
  });

  it("DRY_RUN → 실제 발송 없이 이력 dry_run + report sent", async () => {
    process.env.MAIL_DRY_RUN = "true";
    (getCurrentOperator as ReturnType<typeof vi.fn>).mockResolvedValue({
      email: "me@x.com",
      displayName: "나",
      permission: "member",
    });
    const { client, inserts, updates } = buildAdminMock(APPROVED_REPORT);
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client);

    const r = await sendIncidentReport({
      id: APPROVED_REPORT.id,
      recipient_emails: ["a@b.com", "c@d.com"],
    });

    expect(r.ok).toBe(true);
    expect(sendGraphMail).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(2);
    expect(inserts.every((row) => row.status === "dry_run")).toBe(true);
    expect(updates[0]?.status).toBe("sent");
    expect(updates[0]?.recipient_emails).toEqual(["a@b.com", "c@d.com"]);
  });

  it("비-DRY_RUN → SharePoint 등록 결과를 report에 반영", async () => {
    (getCurrentOperator as ReturnType<typeof vi.fn>).mockResolvedValue({
      email: "me@x.com",
      displayName: "나",
      permission: "member",
    });
    (sendGraphMail as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      messageId: "msg-1",
    });
    (
      registerIncidentReportToSharePoint as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      docNumber: "운영2606-0201",
      sharepointUrl: "https://sp/x",
    });
    const { client, updates } = buildAdminMock(APPROVED_REPORT);
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client);

    const r = await sendIncidentReport({
      id: APPROVED_REPORT.id,
      recipient_emails: ["a@b.com"],
    });

    expect(r.ok).toBe(true);
    expect(registerIncidentReportToSharePoint).toHaveBeenCalledTimes(1);
    expect(updates[0]?.doc_number).toBe("운영2606-0201");
    expect(updates[0]?.sharepoint_url).toBe("https://sp/x");
  });
});
