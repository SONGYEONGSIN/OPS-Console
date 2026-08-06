import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ sendTeamsChatMessage: vi.fn() }));

vi.mock("@/lib/microsoft/teams", () => ({
  sendTeamsChatMessage: h.sendTeamsChatMessage,
}));

import {
  reportSender,
  reportChatId,
  sendAutomationReport,
} from "../report-send";

const ENV_KEYS = [
  "TEAMS_AUTOMATION_SENDER",
  "TEAMS_BRIEFING_SENDER",
  "TEAMS_AUTOMATION_CHAT_ID",
  "AUTOMATION_REPORT_DRY_RUN",
] as const;

describe("report-send", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    h.sendTeamsChatMessage.mockResolvedValue({ id: "msg-1" });
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("발신자는 전용 env → 브리핑 env → 기본값 순으로 정해진다", () => {
    expect(reportSender()).toBe("ys1114@jinhakapply.com");
    process.env.TEAMS_BRIEFING_SENDER = "briefing@x.com";
    expect(reportSender()).toBe("briefing@x.com");
    process.env.TEAMS_AUTOMATION_SENDER = "auto@x.com";
    expect(reportSender()).toBe("auto@x.com");
  });

  it("기본 채팅은 발신자 본인 노트 채팅(48:notes)", () => {
    expect(reportChatId()).toBe("48:notes");
    process.env.TEAMS_AUTOMATION_CHAT_ID = "19:abc";
    expect(reportChatId()).toBe("19:abc");
  });

  it("발송하면 해석된 발신자·채팅으로 Teams에 보낸다", async () => {
    const result = await sendAutomationReport("<p>본문</p>");
    expect(result).toEqual({ sent: true });
    expect(h.sendTeamsChatMessage).toHaveBeenCalledWith({
      operatorEmail: "ys1114@jinhakapply.com",
      chatId: "48:notes",
      html: "<p>본문</p>",
    });
  });

  it("DRY RUN이면 실제로 보내지 않는다", async () => {
    process.env.AUTOMATION_REPORT_DRY_RUN = "true";
    const result = await sendAutomationReport("<p>본문</p>");
    expect(result).toEqual({ sent: false, dryRun: true });
    expect(h.sendTeamsChatMessage).not.toHaveBeenCalled();
  });

  it("발송 실패를 예외로 올리지 않는다 — 보고 때문에 잡이 죽으면 안 된다", async () => {
    h.sendTeamsChatMessage.mockRejectedValue(new Error("Teams 위임 토큰 없음"));
    const result = await sendAutomationReport("<p>본문</p>");
    expect(result.sent).toBe(false);
    expect(result.error).toContain("Teams 위임 토큰 없음");
  });
});
