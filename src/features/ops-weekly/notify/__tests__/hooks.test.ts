import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  deliverNotices: vi.fn(),
  listRecipients: vi.fn(),
  operatorNameOf: vi.fn(),
  recordAutomationRun: vi.fn(),
}));
vi.mock("@/features/automations/run-recorder", () => ({
  recordAutomationRun: m.recordAutomationRun,
}));
vi.mock("../deliver", () => ({ deliverNotices: m.deliverNotices }));
vi.mock("../../settings-queries", () => ({ listRecipients: m.listRecipients }));
vi.mock("../operator-name", () => ({ operatorNameOf: m.operatorNameOf }));

import { NOTIFY_HOOKS } from "../hooks";
import type { OpsWeeklyEvent } from "../../events";

const OK = { sent: 1, failed: 0, dryRun: 0, skipped: 0, errors: [] };
const run = async (ev: OpsWeeklyEvent) => {
  for (const h of NOTIFY_HOOKS) await h.handle(ev);
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://ops.example.com";
  m.deliverNotices.mockResolvedValue(OK);
  m.listRecipients.mockResolvedValue(["boss@x", "lead@x"]);
  m.operatorNameOf.mockResolvedValue("김당번");
});

describe("주간업무보고 이벤트 알림", () => {
  it("전원 제출 → 당번 본인 메일함에서 본인에게", async () => {
    await run({ type: "all-submitted", weekId: "w1", weekStart: "2026-11-16", dutyEmail: "d@x" });
    const t = m.deliverNotices.mock.calls[0][0];
    expect(t).toMatchObject({ weekId: "w1", kind: "all-submitted" });
    expect(t.slot).toMatch(/^all-submitted:/);
    expect(t.mails.map((x: { from: string; to: string }) => [x.from, x.to])).toEqual([["d@x", "d@x"]]);
  });

  it("전원 제출인데 당번이 없으면 던진다 — 아무에게도 안 갔다는 사실을 숨기지 않는다", async () => {
    await expect(
      run({ type: "all-submitted", weekId: "w1", weekStart: "2026-11-16", dutyEmail: null }),
    ).rejects.toThrow("당번이 지정되지 않아");
    expect(m.deliverNotices).not.toHaveBeenCalled();
  });

  it("다시 작성 요청 → 요청한 사람 메일함에서 작성자에게, 사유·이름 포함", async () => {
    await run({
      type: "report-returned",
      weekId: "w1",
      weekStart: "2026-11-16",
      operatorEmail: "a@x",
      returnedBy: "d@x",
      reason: "표 확인",
    });
    const t = m.deliverNotices.mock.calls[0][0];
    expect(t.kind).toBe("returned");
    expect(t.mails[0]).toMatchObject({ from: "d@x", to: "a@x" });
    expect(t.mails[0].mail.html).toContain("표 확인");
    expect(t.mails[0].mail.html).toContain("김당번");
  });

  it("최종 보고 → 보고한 사람 메일함에서 받는 사람 전원에게, 슬롯 reported", async () => {
    await run({ type: "week-reported", weekId: "w1", weekStart: "2026-11-16", reportedBy: "d@x", correction: false });
    const t = m.deliverNotices.mock.calls[0][0];
    expect(t).toMatchObject({ kind: "reported", slot: "reported" });
    expect(t.mails.map((x: { from: string; to: string }) => [x.from, x.to])).toEqual([
      ["d@x", "boss@x"],
      ["d@x", "lead@x"],
    ]);
    expect(t.mails[0].mail.html).toContain("op=all");
  });

  it("정정 뒤 다시 보고는 메일을 다시 보내지 않는다", async () => {
    await run({ type: "week-reported", weekId: "w1", weekStart: "2026-11-16", reportedBy: "d@x", correction: true });
    expect(m.deliverNotices).not.toHaveBeenCalled();
  });

  it("받는 사람이 0명이면 던진다", async () => {
    m.listRecipients.mockResolvedValue([]);
    await expect(
      run({ type: "week-reported", weekId: "w1", weekStart: "2026-11-16", reportedBy: "d@x", correction: false }),
    ).rejects.toThrow("받는 사람이 없어");
  });

  it("발송 실패가 있으면 던진다(이력은 deliver 가 남겼다)", async () => {
    m.deliverNotices.mockResolvedValue({ ...OK, sent: 0, failed: 1, errors: ["d@x: 403"] });
    await expect(
      run({ type: "all-submitted", weekId: "w1", weekStart: "2026-11-16", dutyEmail: "d@x" }),
    ).rejects.toThrow("d@x: 403");
    expect(m.recordAutomationRun).toHaveBeenCalledWith("ops-weekly-notify", {
      ok: false,
      message: "전원 제출 알림 — 실패 1 (d@x: 403)",
    });
  });

  it("보내면 실행 기록을 남긴다 — 실패 즉시 알림·일일 보고가 이 기록을 본다", async () => {
    await run({ type: "all-submitted", weekId: "w1", weekStart: "2026-11-16", dutyEmail: "d@x" });
    expect(m.recordAutomationRun).toHaveBeenCalledWith("ops-weekly-notify", {
      ok: true,
      message: "전원 제출 알림 — 보냄 1",
    });
  });
});
