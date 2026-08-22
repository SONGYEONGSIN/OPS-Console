import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { revalidatePath } from "next/cache";

const sendGraphMail: Mock = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/microsoft/sendmail", () => ({
  sendGraphMail: (...a: unknown[]) => sendGraphMail(...a),
}));

const insertMock: Mock = vi.fn(async () => ({ error: null }));
const maybeSingleMock: Mock = vi.fn(async () => ({
  data: { name: "나", department: "운영부", team: "운영2팀", role: "팀장", phone: "(02)000-0000" },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      insert: insertMock,
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
    }),
  })),
}));

const getCurrentOperator: Mock = vi.fn(async () => ({
  email: "me@op.com",
  operator: { name: "나" },
  permission: "member",
}));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => getCurrentOperator(),
}));

/** 서버가 폼을 믿지 않고 DB에서 다시 읽는 담당자 조회 */
const findOpenNoticeService: Mock = vi.fn(async () => ({
  serviceId: 1130058,
  operatorName: "나",
  universityName: "조선대학교",
  serviceName: "2027학년도 수시모집",
}));
vi.mock("../queries", () => ({
  findOpenNoticeService: (...a: unknown[]) => findOpenNoticeService(...a),
}));

import { sendOpenNoticeAction } from "../actions";

function fd(over: Record<string, string> = {}) {
  const f = new FormData();
  f.set("serviceId", "1130058");
  f.set("universityName", "조선대학교");
  f.set("serviceName", "2027학년도 수시모집");
  f.set("toEmail", "a@b.com");
  f.set("toName", "김담당");
  f.set("cc", JSON.stringify([{ email: "c@d.com" }]));
  f.set("subject", "[진학어플라이] 조선대학교 2027학년도 수시모집 인터넷 원서접수 오픈 안내");
  f.set("body", "· 대학명   : 조선대학교");
  f.set("mode", "now");
  for (const [k, v] of Object.entries(over)) f.set(k, v);
  return f;
}

describe("sendOpenNoticeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendGraphMail.mockResolvedValue({ ok: true });
    insertMock.mockResolvedValue({ error: null });
    getCurrentOperator.mockResolvedValue({
      email: "me@op.com",
      operator: { name: "나" },
      permission: "member",
    });
    findOpenNoticeService.mockResolvedValue({
      serviceId: 1130058,
      operatorName: "나",
      universityName: "조선대학교",
      serviceName: "2027학년도 수시모집",
    });
    delete process.env.MAIL_DRY_RUN;
  });

  it("미인증이면 ok:false", async () => {
    getCurrentOperator.mockResolvedValue(null as unknown);
    const r = await sendOpenNoticeAction(undefined, fd());
    expect(r?.ok).toBe(false);
    expect(sendGraphMail).not.toHaveBeenCalled();
  });

  it("toEmail 형식 불량이면 발송 안 함", async () => {
    const r = await sendOpenNoticeAction(undefined, fd({ toEmail: "x" }));
    expect(r?.ok).toBe(false);
    expect(sendGraphMail).not.toHaveBeenCalled();
  });

  it("정상 발송 — 본인 명의 + 공백 보존 HTML + insert(sent)", async () => {
    const r = await sendOpenNoticeAction(undefined, fd());
    expect(r?.ok).toBe(true);
    expect(sendGraphMail).toHaveBeenCalledTimes(1);
    const call = sendGraphMail.mock.calls[0] as [Record<string, unknown>];
    expect(call[0]).toMatchObject({ senderUserId: "me@op.com", toEmail: "a@b.com" });
    // buildReplyHtml 을 쓰면 여기가 무너진다 (연속 공백이 1칸으로 접힘)
    expect(String(call[0].html)).toContain("&nbsp;&nbsp;&nbsp;");
    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = (insertMock.mock.calls[0] as [Record<string, unknown>])[0];
    expect(row).toMatchObject({ service_id: 1130058, status: "sent" });
  });

  it("배지가 갱신되도록 dev-test 경로를 revalidate 한다", async () => {
    await sendOpenNoticeAction(undefined, fd());
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/dev-test");
  });

  it("MAIL_DRY_RUN 이면 발송 없이 dry_run 만 적재", async () => {
    process.env.MAIL_DRY_RUN = "true";
    const r = await sendOpenNoticeAction(undefined, fd());
    expect(r?.ok).toBe(true);
    expect(sendGraphMail).not.toHaveBeenCalled();
    const row = (insertMock.mock.calls[0] as [Record<string, unknown>])[0];
    expect(row).toMatchObject({ status: "dry_run" });
  });

  it("Graph 실패면 ok:false + failed 적재", async () => {
    sendGraphMail.mockResolvedValue({ ok: false, error: "boom" });
    const r = await sendOpenNoticeAction(undefined, fd());
    expect(r?.ok).toBe(false);
    const row = (insertMock.mock.calls[0] as [Record<string, unknown>])[0];
    expect(row).toMatchObject({ status: "failed", error: "boom" });
  });

  describe("발송 권한 — 본인 담당 건만", () => {
    it("남의 담당 서비스면 거부하고 발송하지 않는다", async () => {
      findOpenNoticeService.mockResolvedValue({
        serviceId: 1130058,
        operatorName: "다른사람",
        universityName: "조선대학교",
        serviceName: "2027학년도 수시모집",
      });
      const r = await sendOpenNoticeAction(undefined, fd());
      expect(r?.ok).toBe(false);
      expect(sendGraphMail).not.toHaveBeenCalled();
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("admin 은 남의 담당도 보낼 수 있다", async () => {
      getCurrentOperator.mockResolvedValue({
        email: "boss@op.com",
        operator: { name: "관리자" },
        permission: "admin",
      });
      findOpenNoticeService.mockResolvedValue({
        serviceId: 1130058,
        operatorName: "다른사람",
        universityName: "조선대학교",
        serviceName: "2027학년도 수시모집",
      });
      const r = await sendOpenNoticeAction(undefined, fd());
      expect(r?.ok).toBe(true);
      expect(sendGraphMail).toHaveBeenCalledTimes(1);
    });

    it("operators 매칭이 없으면 담당 건이 없다 (거부)", async () => {
      getCurrentOperator.mockResolvedValue({
        email: "dev@op.com",
        operator: null,
        permission: "member",
      });
      const r = await sendOpenNoticeAction(undefined, fd());
      expect(r?.ok).toBe(false);
      expect(sendGraphMail).not.toHaveBeenCalled();
    });

    it("DB 에 없는 서비스면 거부한다", async () => {
      findOpenNoticeService.mockResolvedValue(null);
      const r = await sendOpenNoticeAction(undefined, fd());
      expect(r?.ok).toBe(false);
      expect(sendGraphMail).not.toHaveBeenCalled();
    });

    it("폼이 보낸 담당자명을 믿지 않는다 — DB 조회 결과로 판정", async () => {
      // 폼에 남의 이름이 실려와도 DB 가 본인이면 통과해야 한다
      const r = await sendOpenNoticeAction(undefined, fd({ operatorName: "위조" }));
      expect(r?.ok).toBe(true);
      expect(findOpenNoticeService).toHaveBeenCalledWith(1130058);
    });
  });

  describe("예약 발송", () => {
    it("미래 시각이면 발송하지 않고 scheduled 적재", async () => {
      const future = new Date(Date.now() + 3600_000);
      const local = new Date(future.getTime() + 9 * 3600_000).toISOString().slice(0, 16);
      const r = await sendOpenNoticeAction(
        undefined,
        fd({ mode: "schedule", scheduledAt: local }),
      );
      expect(r?.ok).toBe(true);
      expect(sendGraphMail).not.toHaveBeenCalled();
      const row = (insertMock.mock.calls[0] as [Record<string, unknown>])[0];
      expect(row).toMatchObject({ status: "scheduled" });
      expect(row.scheduled_at).toBeTruthy();
    });

    it("과거 시각이면 거부", async () => {
      const r = await sendOpenNoticeAction(
        undefined,
        fd({ mode: "schedule", scheduledAt: "2020-01-01T10:00" }),
      );
      expect(r?.ok).toBe(false);
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("예약 시각이 비면 거부", async () => {
      const r = await sendOpenNoticeAction(undefined, fd({ mode: "schedule" }));
      expect(r?.ok).toBe(false);
      expect(insertMock).not.toHaveBeenCalled();
    });
  });
});
