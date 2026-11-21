import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const sendGraphMail = vi.fn();
vi.mock("@/lib/microsoft/sendmail", () => ({
  sendGraphMail: (...a: unknown[]) => sendGraphMail(...a),
}));
const sendTeamsChatMessage = vi.fn();
vi.mock("@/lib/microsoft/teams", () => ({
  sendTeamsChatMessage: (...a: unknown[]) => sendTeamsChatMessage(...a),
}));
const delivered = vi.fn();
const record = vi.fn();
vi.mock("../store", () => ({
  deliveredRecipients: (...a: unknown[]) => delivered(...a),
  recordNotices: (...a: unknown[]) => record(...a),
}));

import { deliverNotices } from "../deliver";

const MAIL = { subject: "제목", html: "<p>본문</p>" };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.OPS_WEEKLY_NOTIFY_DRY_RUN;
  process.env.TEAMS_AUTOMATION_SENDER = "auto@x.com";
  delivered.mockResolvedValue(new Set<string>());
  record.mockResolvedValue(undefined);
  sendGraphMail.mockResolvedValue({ ok: true });
  sendTeamsChatMessage.mockResolvedValue({ id: "m1" });
});

describe("deliverNotices", () => {
  it("메일을 보내고 이력을 남긴다 — 이미 보낸 사람은 건너뛴다", async () => {
    delivered.mockResolvedValue(new Set(["b@x"]));
    const t = await deliverNotices({
      weekId: "w1",
      kind: "request",
      slot: "request",
      mails: [
        { from: "a@x", to: "a@x", mail: MAIL },
        { from: "b@x", to: "b@x", mail: MAIL },
      ],
    });
    expect(sendGraphMail).toHaveBeenCalledTimes(1);
    expect(sendGraphMail).toHaveBeenCalledWith({
      senderUserId: "a@x",
      toEmail: "a@x",
      subject: "제목",
      html: "<p>본문</p>",
    });
    expect(t).toMatchObject({ sent: 1, skipped: 1, failed: 0, dryRun: 0 });
    expect(record).toHaveBeenCalledWith([
      { week_id: "w1", kind: "request", slot: "request", recipient: "a@x", status: "sent", error: null },
    ]);
  });

  it("실패는 failed 로 남기고 다음 사람은 계속 보낸다", async () => {
    sendGraphMail
      .mockResolvedValueOnce({ ok: false, error: "403" })
      .mockResolvedValueOnce({ ok: true });
    const t = await deliverNotices({
      weekId: "w1",
      kind: "remind",
      slot: "remind:2026-11-19:noon",
      mails: [
        { from: "a@x", to: "a@x", mail: MAIL },
        { from: "b@x", to: "b@x", mail: MAIL },
      ],
    });
    expect(t).toMatchObject({ sent: 1, failed: 1 });
    expect(t.errors).toEqual(["a@x: 403"]);
    expect(record.mock.calls[0][0].map((r: { status: string }) => r.status)).toEqual(["failed", "sent"]);
  });

  it("DRY_RUN 이면 보내지 않고 dry_run 으로만 남긴다", async () => {
    process.env.OPS_WEEKLY_NOTIFY_DRY_RUN = "true";
    const t = await deliverNotices({
      weekId: "w1",
      kind: "request",
      slot: "request",
      mails: [{ from: "a@x", to: "a@x", mail: MAIL }],
      teams: { chatId: "19:chat", html: "<p>t</p>" },
    });
    expect(sendGraphMail).not.toHaveBeenCalled();
    expect(sendTeamsChatMessage).not.toHaveBeenCalled();
    expect(t).toMatchObject({ dryRun: 2, sent: 0 });
  });

  it("Teams 는 자동화 발신 계정으로, 받는 사람 키는 teams:<id>", async () => {
    const t = await deliverNotices({
      weekId: "w1",
      kind: "request",
      slot: "request",
      mails: [],
      teams: { chatId: "19:chat", html: "<p>t</p>" },
    });
    expect(sendTeamsChatMessage).toHaveBeenCalledWith({
      operatorEmail: "auto@x.com",
      chatId: "19:chat",
      html: "<p>t</p>",
    });
    expect(t.sent).toBe(1);
    expect(record.mock.calls[0][0][0].recipient).toBe("teams:19:chat");
  });

  it("Teams 전송이 던지면 failed — 메일 결과는 그대로", async () => {
    sendTeamsChatMessage.mockRejectedValue(new Error("위임 토큰 없음"));
    const t = await deliverNotices({
      weekId: "w1",
      kind: "request",
      slot: "request",
      mails: [{ from: "a@x", to: "a@x", mail: MAIL }],
      teams: { chatId: "19:chat", html: "<p>t</p>" },
    });
    expect(t).toMatchObject({ sent: 1, failed: 1 });
    expect(t.errors[0]).toContain("위임 토큰 없음");
  });

  it("보낼 사람이 없으면 조회만 하고 기록하지 않는다", async () => {
    const t = await deliverNotices({ weekId: "w1", kind: "remind", slot: "s", mails: [] });
    expect(record).not.toHaveBeenCalled();
    expect(t).toMatchObject({ sent: 0, skipped: 0 });
  });
});
