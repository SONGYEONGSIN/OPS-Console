import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const sendGraphMail: Mock = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/microsoft/sendmail", () => ({ sendGraphMail: (...a: unknown[]) => sendGraphMail(...a) }));
const insertMock: Mock = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: () => ({ insert: insertMock }) })),
}));
const getCurrentOperator: Mock = vi.fn(async () => ({ email: "me@op.com", displayName: "나" }));
vi.mock("@/features/auth/queries", () => ({ getCurrentOperator: () => getCurrentOperator() }));

import { sendDataRequestAction } from "../actions";

function fd(over: Record<string, string> = {}) {
  const f = new FormData();
  f.set("universityName", "조선대학교");
  f.set("serviceName", "수시모집");
  f.set("writeStart", "2025.05.11");
  f.set("writeEnd", "2025.06.02");
  f.set("serviceId", "svc-1");
  f.set("toEmail", "a@b.com");
  f.set("toName", "김담당");
  f.set("cc", JSON.stringify([{ email: "c@d.com" }]));
  for (const [k, v] of Object.entries(over)) f.set(k, v);
  return f;
}

describe("sendDataRequestAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendGraphMail.mockResolvedValue({ ok: true });
    getCurrentOperator.mockResolvedValue({ email: "me@op.com", displayName: "나" });
    delete process.env.MAIL_DRY_RUN;
  });

  it("미인증이면 ok:false", async () => {
    getCurrentOperator.mockResolvedValue(null as unknown);
    const r = await sendDataRequestAction(undefined, fd());
    expect(r?.ok).toBe(false);
  });

  it("toEmail 형식 불량이면 ok:false (발송 안 함)", async () => {
    const r = await sendDataRequestAction(undefined, fd({ toEmail: "x" }));
    expect(r?.ok).toBe(false);
    expect(sendGraphMail).not.toHaveBeenCalled();
  });

  it("정상 발송 — 발신자=본인 + sendGraphMail(시스템 생성 메일) + insert(sent)", async () => {
    const r = await sendDataRequestAction(undefined, fd());
    expect(sendGraphMail).toHaveBeenCalledTimes(1);
    const mailCall = sendGraphMail.mock.calls[0] as [Record<string, unknown>];
    expect(mailCall[0]).toMatchObject({ senderUserId: "me@op.com", toEmail: "a@b.com" });
    expect(mailCall[0].subject).toContain("[진학어플라이]");
    expect(mailCall[0].html).toContain("요청 항목");
    expect(insertMock).toHaveBeenCalled();
    const insertCall = insertMock.mock.calls[0] as [Record<string, unknown>];
    expect(insertCall[0]).toMatchObject({ status: "sent", sender_email: "me@op.com" });
    expect(r?.ok).toBe(true);
  });

  it("MAIL_DRY_RUN=true면 미발송 + insert(dry_run)", async () => {
    process.env.MAIL_DRY_RUN = "true";
    const r = await sendDataRequestAction(undefined, fd());
    expect(sendGraphMail).not.toHaveBeenCalled();
    const insertCall = insertMock.mock.calls[0] as [Record<string, unknown>];
    expect(insertCall[0]).toMatchObject({ status: "dry_run" });
    expect(r?.ok).toBe(true);
  });

  it("Graph 실패면 insert(failed) + ok:false", async () => {
    sendGraphMail.mockResolvedValue({ ok: false, error: "401" } as unknown);
    const r = await sendDataRequestAction(undefined, fd());
    const insertCall = insertMock.mock.calls[0] as [Record<string, unknown>];
    expect(insertCall[0]).toMatchObject({ status: "failed" });
    expect(r?.ok).toBe(false);
  });

  it("insert 에러 발생 시 ok:true + message에 이력 저장 실패 포함", async () => {
    insertMock.mockResolvedValueOnce({ error: { message: "rls" } });
    const r = await sendDataRequestAction(undefined, fd());
    expect(r?.ok).toBe(true);
    expect(r?.message).toContain("이력 저장 실패");
  });
});
