import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SendGraphMailArgs, SendMailResult } from "@/lib/microsoft/sendmail";

type MockedSendMail = (args: SendGraphMailArgs) => Promise<SendMailResult>;
const sendGraphMail = vi.fn<MockedSendMail>(async () => ({ ok: true }));
vi.mock("@/lib/microsoft/sendmail", () => ({ sendGraphMail: (a: SendGraphMailArgs) => sendGraphMail(a) }));
const rpcMock = vi.fn();
const updateEqMock = vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null }));
const updateMock = vi.fn((patch: Record<string, unknown>) => {
  void patch;
  return { eq: updateEqMock };
});
const maybeSingleMock = vi.fn(async () => ({
  data: { name: "나", department: "운영부", team: "운영2팀", role: "팀장", phone: "(02)000-0000" },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: rpcMock,
    from: (table: string) =>
      table === "operators"
        ? { select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) }
        : { update: updateMock },
  })),
}));

import { POST } from "../route";

function req(secret?: string) {
  return new Request("http://localhost/api/data-requests/dispatch", {
    method: "POST",
    headers: secret ? { "x-cron-secret": secret } : {},
  });
}

describe("dispatch route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    delete process.env.MAIL_DRY_RUN;
    sendGraphMail.mockResolvedValue({ ok: true });
    rpcMock.mockResolvedValue({ data: [], error: null });
  });

  it("시크릿 불일치 → 401", async () => {
    const res = await POST(req("wrong"));
    expect(res.status).toBe(401);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("시크릿 없음 → 401", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it("시크릿 일치 + due 행 → 각각 발송 + 상태 갱신 + 요약", async () => {
    rpcMock.mockResolvedValue({
      data: [
        { id: "1", sender_email: "me@op.com", to_email: "a@b.com", to_name: "A", cc: [], subject: "s1", body: "b1" },
        { id: "2", sender_email: "me@op.com", to_email: "c@d.com", to_name: null, cc: [], subject: "s2", body: "b2" },
      ],
      error: null,
    });
    sendGraphMail
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, error: "401" } satisfies SendMailResult);
    const res = await POST(req("s3cr3t"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(sendGraphMail).toHaveBeenCalledTimes(2);
    expect(updateEqMock).toHaveBeenCalledTimes(2);
    expect(sendGraphMail.mock.calls[0][0]).toMatchObject({ senderUserId: "me@op.com", toEmail: "a@b.com" });
    // 평문 text 대신 HTML(본문 + 운영자 서명)로 발송
    expect(sendGraphMail.mock.calls[0][0].text).toBeUndefined();
    expect(sendGraphMail.mock.calls[0][0].html).toContain("b1");
    expect(sendGraphMail.mock.calls[0][0].html).toContain("(주)진학어플라이");
    expect(json).toMatchObject({ ok: true, dispatched: 2, sent: 1, failed: 1, updateFailed: 0 });
  });

  it("due 행 없으면 dispatched:0", async () => {
    const res = await POST(req("s3cr3t"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, dispatched: 0, sent: 0, failed: 0, updateFailed: 0 });
    expect(sendGraphMail).not.toHaveBeenCalled();
  });

  it("MAIL_DRY_RUN=true 면 발송하지 않고 dry_run으로 기록", async () => {
    process.env.MAIL_DRY_RUN = "true";
    rpcMock.mockResolvedValue({
      data: [{ id: "1", sender_email: "me@op.com", to_email: "a@b.com", to_name: "A", cc: [], subject: "s", body: "b" }],
      error: null,
    });
    const res = await POST(req("s3cr3t"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(sendGraphMail).not.toHaveBeenCalled();
    expect(json).toMatchObject({ ok: true, dispatched: 1, dryRun: 1, sent: 0, failed: 0 });
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0]).toMatchObject({ status: "dry_run" });
  });

  it("상태 업데이트 실패가 updateFailed로 집계된다", async () => {
    rpcMock.mockResolvedValue({
      data: [{ id: "1", sender_email: "me@op.com", to_email: "a@b.com", to_name: null, cc: [], subject: "s", body: "b" }],
      error: null,
    });
    updateEqMock.mockResolvedValueOnce({ error: { message: "rls" } });
    const res = await POST(req("s3cr3t"));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, dispatched: 1, sent: 1, updateFailed: 1 });
  });
});
