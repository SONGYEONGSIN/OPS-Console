import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SendGraphMailArgs, SendMailResult } from "@/lib/microsoft/sendmail";

type MockedSendMail = (args: SendGraphMailArgs) => Promise<SendMailResult>;
const sendGraphMail = vi.fn<MockedSendMail>(async () => ({ ok: true }));
vi.mock("@/lib/microsoft/sendmail", () => ({
  sendGraphMail: (a: SendGraphMailArgs) => sendGraphMail(a),
}));

const rpcMock = vi.fn();
const updateEqMock = vi.fn(
  async (): Promise<{ error: { message: string } | null }> => ({ error: null }),
);
const updateMock = vi.fn((patch: Record<string, unknown>) => {
  void patch;
  return { eq: updateEqMock };
});
const maybeSingleMock = vi.fn(async () => ({
  data: {
    name: "나",
    department: "운영부",
    team: "운영2팀",
    role: "팀장",
    phone: "(02)000-0000",
  },
}));
const fromMock = vi.fn((table: string) =>
  table === "operators"
    ? { select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) }
    : { update: updateMock },
);
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ rpc: rpcMock, from: fromMock })),
}));

import { POST, GET } from "../route";

function req(secret?: string, mode: "header" | "bearer" = "header") {
  const headers: Record<string, string> = {};
  if (secret) {
    if (mode === "bearer") headers.authorization = `Bearer ${secret}`;
    else headers["x-cron-secret"] = secret;
  }
  return new Request("http://localhost/api/open-notices/dispatch", {
    method: "POST",
    headers,
  });
}

const dueRow = (over: Record<string, unknown> = {}) => ({
  id: "1",
  sender_email: "me@op.com",
  to_email: "a@b.com",
  to_name: "A",
  cc: [],
  subject: "s1",
  body: "· 대학명   : 조선대학교",
  ...over,
});

describe("open-notices dispatch route", () => {
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
    expect((await POST(req())).status).toBe(401);
  });

  it("Bearer 헤더도 받는다 (Vercel Cron 호환)", async () => {
    expect((await GET(req("s3cr3t", "bearer"))).status).toBe(200);
  });

  it("오픈안내 큐를 claim 한다", async () => {
    await POST(req("s3cr3t"));
    expect(rpcMock).toHaveBeenCalledWith("claim_due_open_notices");
  });

  it("due 행 없으면 dispatched:0", async () => {
    const json = await (await POST(req("s3cr3t"))).json();
    expect(json).toMatchObject({ ok: true, dispatched: 0, sent: 0, failed: 0, updateFailed: 0 });
    expect(sendGraphMail).not.toHaveBeenCalled();
  });

  it("due 행 → 발송 + 상태 갱신 + 요약", async () => {
    rpcMock.mockResolvedValue({
      data: [dueRow(), dueRow({ id: "2", to_email: "c@d.com", to_name: null, subject: "s2" })],
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
    expect(json).toMatchObject({ ok: true, dispatched: 2, sent: 1, failed: 1, updateFailed: 0 });
  });

  it("예약분도 공백 보존 HTML 로 나간다 (즉시 발송과 결과가 갈리면 안 된다)", async () => {
    rpcMock.mockResolvedValue({ data: [dueRow()], error: null });
    await POST(req("s3cr3t"));
    const args = sendGraphMail.mock.calls[0][0];
    expect(args.text).toBeUndefined();
    // buildReplyHtml 을 쓰면 연속 공백이 접혀 이 단언이 깨진다
    expect(args.html).toContain("&nbsp;&nbsp;&nbsp;");
    expect(args.html).toContain("(주)진학어플라이");
  });

  it("open_notice_sends 테이블을 갱신한다", async () => {
    rpcMock.mockResolvedValue({ data: [dueRow()], error: null });
    await POST(req("s3cr3t"));
    expect(fromMock).toHaveBeenCalledWith("open_notice_sends");
  });

  it("MAIL_DRY_RUN=true 면 발송하지 않고 dry_run 기록", async () => {
    process.env.MAIL_DRY_RUN = "true";
    rpcMock.mockResolvedValue({ data: [dueRow()], error: null });
    const json = await (await POST(req("s3cr3t"))).json();
    expect(sendGraphMail).not.toHaveBeenCalled();
    expect(json).toMatchObject({ ok: true, dispatched: 1, dryRun: 1, sent: 0, failed: 0 });
    expect(updateMock.mock.calls[0][0]).toMatchObject({ status: "dry_run" });
  });

  it("상태 업데이트 실패가 updateFailed 로 집계된다", async () => {
    rpcMock.mockResolvedValue({ data: [dueRow()], error: null });
    updateEqMock.mockResolvedValueOnce({ error: { message: "rls" } });
    const json = await (await POST(req("s3cr3t"))).json();
    expect(json).toMatchObject({ ok: true, dispatched: 1, sent: 1, updateFailed: 1 });
  });

  it("claim 실패면 500", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST(req("s3cr3t"));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, error: "boom" });
  });
});
