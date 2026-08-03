import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RatioAuditIngest, RatioFinding } from "../schemas";

const h = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  ensureOneOnOneChat: vi.fn(),
  sendTeamsChatMessage: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: h.from }),
}));
vi.mock("@/lib/microsoft/teams", () => ({
  ensureOneOnOneChat: h.ensureOneOnOneChat,
  sendTeamsChatMessage: h.sendTeamsChatMessage,
}));

function finding(university: string, operatorName: string): RatioFinding {
  return {
    serviceId: 1,
    seq: 1,
    universityName: university,
    serviceName: "수시",
    operatorName,
    scheduleLines: [
      "2026-09-08 오전 9:00:00 ~ 2026-09-10 오후 4:03:00 : 60분 반복",
    ],
    items: [
      {
        type: "schedule",
        field: "top",
        found: "9월 11일",
        expect: "9월 10일",
        quote: "",
      },
    ],
  };
}

const base: RatioAuditIngest = {
  scannedCount: 40,
  findings: [],
  linkErrors: [],
  skipped: [],
};

const OPERATORS = [
  { name: "김지나", email: "kjn@jinhakapply.com" },
  { name: "이해영", email: "lhy@jinhakapply.com" },
];

describe("dispatchRatioAudit", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const fn of Object.values(h)) fn.mockReset();
    process.env.TEAMS_RATIO_AUDIT_ADMIN_CHAT_ID = "admin-chat";
    process.env.TEAMS_RATIO_AUDIT_SENDER = "sender@jinhakapply.com";
    h.select.mockResolvedValue({ data: OPERATORS, error: null });
    h.from.mockReturnValue({ select: h.select });
    h.ensureOneOnOneChat.mockImplementation(
      async (args: { targetEmail: string }) => `chat:${args.targetEmail}`,
    );
    h.sendTeamsChatMessage.mockResolvedValue({ id: "msg" });
  });

  it("담당자별 1:1 채팅으로 본인 담당 건만 보낸다", async () => {
    const { dispatchRatioAudit } = await import("../dispatch");
    const r = await dispatchRatioAudit({
      ...base,
      findings: [
        finding("한국체육대학교", "김지나"),
        finding("대구가톨릭대학교", "이해영"),
        finding("수원대학교", "김지나"),
      ],
    });

    expect(r.sent).toBe(2);
    expect(h.ensureOneOnOneChat).toHaveBeenCalledTimes(2);
    const targets = h.sendTeamsChatMessage.mock.calls.map((c) => c[0].chatId);
    expect(targets).toContain("chat:kjn@jinhakapply.com");
    expect(targets).toContain("chat:lhy@jinhakapply.com");

    const toKim = h.sendTeamsChatMessage.mock.calls.find(
      (c) => c[0].chatId === "chat:kjn@jinhakapply.com",
    )![0].html;
    expect(toKim).toContain("한국체육대학교");
    expect(toKim).toContain("수원대학교");
    // 남의 담당 건이 섞이면 안 된다.
    expect(toKim).not.toContain("대구가톨릭대학교");
  });

  it("operators에 없는 담당자 건은 개인 발송 없이 관리자 채팅으로 취합한다", async () => {
    const { dispatchRatioAudit } = await import("../dispatch");
    const r = await dispatchRatioAudit({
      ...base,
      findings: [
        finding("가천대학교", "없는사람"),
        finding("한국체육대학교", "김지나"),
      ],
    });

    expect(r.sent).toBe(1);
    expect(r.unassignedCount).toBe(1);
    expect(r.adminNotified).toBe(true);
    const adminCall = h.sendTeamsChatMessage.mock.calls.find(
      (c) => c[0].chatId === "admin-chat",
    )!;
    expect(adminCall[0].html).toContain("가천대학교");
    expect(adminCall[0].html).not.toContain("한국체육대학교");
  });

  it("담당자 이름이 비어 있어도 조용히 사라지지 않고 관리자에게 간다", async () => {
    const { dispatchRatioAudit } = await import("../dispatch");
    const r = await dispatchRatioAudit({
      ...base,
      findings: [finding("가천대학교", "")],
    });
    expect(r.sent).toBe(0);
    expect(r.unassignedCount).toBe(1);
    expect(r.adminNotified).toBe(true);
  });

  it("개인 발송이 실패해도 나머지는 계속 보내고 실패를 관리자에게 알린다", async () => {
    h.sendTeamsChatMessage.mockImplementation(
      async (args: { chatId: string }) => {
        if (args.chatId === "chat:kjn@jinhakapply.com")
          throw new Error("graph 500");
        return { id: "msg" };
      },
    );
    const { dispatchRatioAudit } = await import("../dispatch");
    const r = await dispatchRatioAudit({
      ...base,
      findings: [
        finding("한국체육대학교", "김지나"),
        finding("대구가톨릭대학교", "이해영"),
      ],
    });

    expect(r.sent).toBe(1);
    expect(r.failed).toEqual([{ operatorName: "김지나", reason: "graph 500" }]);
    const adminCall = h.sendTeamsChatMessage.mock.calls.find(
      (c) => c[0].chatId === "admin-chat",
    )!;
    expect(adminCall[0].html).toContain("김지나");
    expect(adminCall[0].html).toContain("graph 500");
  });

  it("관리자 채널을 지정하지 않으면 발신자 본인 노트 채팅으로 보낸다", async () => {
    // env 하나 빠뜨렸다고 '담당 미상'이 아무 데도 안 남으면 안 된다.
    delete process.env.TEAMS_RATIO_AUDIT_ADMIN_CHAT_ID;
    const { dispatchRatioAudit } = await import("../dispatch");
    const r = await dispatchRatioAudit({
      ...base,
      findings: [finding("가천대학교", "없는사람")],
    });
    expect(r.adminNotified).toBe(true);
    expect(h.sendTeamsChatMessage.mock.calls[0][0].chatId).toBe("48:notes");
  });

  it("이상·링크오류·건너뜀이 모두 없으면 아무에게도 보내지 않는다", async () => {
    const { dispatchRatioAudit } = await import("../dispatch");
    const r = await dispatchRatioAudit(base);
    expect(h.sendTeamsChatMessage).not.toHaveBeenCalled();
    expect(r.sent).toBe(0);
    expect(r.adminNotified).toBe(false);
  });

  it("이상은 없어도 링크오류가 있으면 관리자에게 알린다", async () => {
    const { dispatchRatioAudit } = await import("../dispatch");
    const r = await dispatchRatioAudit({
      ...base,
      linkErrors: [
        { serviceId: 7, url: "https://x.test/a.html", status: 404, reason: "" },
      ],
    });
    expect(r.adminNotified).toBe(true);
    expect(h.sendTeamsChatMessage.mock.calls[0][0].chatId).toBe("admin-chat");
  });
});
