import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  ensureWeek: vi.fn(),
  listWriters: vi.fn(),
  listPendingWriters: vi.fn(),
  deliverNotices: vi.fn(),
}));
vi.mock("../../week-queries", () => ({
  ensureWeek: m.ensureWeek,
  listWriters: m.listWriters,
}));
vi.mock("../../report-queries", () => ({ listPendingWriters: m.listPendingWriters }));
vi.mock("../deliver", () => ({ deliverNotices: m.deliverNotices }));

import { remindSlotOf, sendRemind, sendRequest } from "../run";

const WEEK = { id: "w1", week_start: "2026-11-16", status: "open" as const };
const writer = (email: string) => ({ email, name: email, team: "운영1팀", role: "매니저", status: "active" });
const TALLY = { sent: 2, failed: 0, dryRun: 0, skipped: 0, errors: [] };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.OPS_WEEKLY_TEAMS_CHAT_ID;
  process.env.NEXT_PUBLIC_APP_URL = "https://ops.example.com/";
  m.ensureWeek.mockResolvedValue(WEEK);
  m.listWriters.mockResolvedValue([writer("a@x"), writer("b@x")]);
  m.listPendingWriters.mockResolvedValue([writer("b@x")]);
  m.deliverNotices.mockResolvedValue(TALLY);
});

const NOW_WED = new Date("2026-11-18T01:00:00Z"); // 수 10:00 KST

describe("sendRequest — 수요일 작성 요청", () => {
  it("이번 주 작성자 전원에게 본인 → 본인 메일, Teams 는 채팅 id 가 있을 때만", async () => {
    const r = await sendRequest(NOW_WED);
    expect(m.ensureWeek).toHaveBeenCalledWith("2026-11-16", NOW_WED);
    const t = m.deliverNotices.mock.calls[0][0];
    expect(t).toMatchObject({ weekId: "w1", kind: "request", slot: "request", teams: undefined });
    expect(t.mails.map((x: { from: string; to: string }) => [x.from, x.to])).toEqual([
      ["a@x", "a@x"],
      ["b@x", "b@x"],
    ]);
    expect(t.mails[0].mail.html).toContain("https://ops.example.com/dashboard/ops-weekly?week=2026-11-16");
    expect(r).toMatchObject({ kind: "sent", teams: "unset", tally: TALLY });
  });

  it("OPS_WEEKLY_TEAMS_CHAT_ID 가 있으면 그룹채팅도", async () => {
    process.env.OPS_WEEKLY_TEAMS_CHAT_ID = "19:chat";
    const r = await sendRequest(NOW_WED);
    expect(m.deliverNotices.mock.calls[0][0].teams.chatId).toBe("19:chat");
    expect(r).toMatchObject({ teams: "set" });
  });

  it("이미 보고된 주면 보내지 않는다", async () => {
    m.ensureWeek.mockResolvedValue({ ...WEEK, status: "reported" });
    expect(await sendRequest(NOW_WED)).toEqual({ kind: "skipped", reason: "이미 보고된 주입니다" });
    expect(m.deliverNotices).not.toHaveBeenCalled();
  });

  it("명단이 비었으면 실패(조용히 0통이 아니다)", async () => {
    m.listWriters.mockResolvedValue([]);
    expect(await sendRequest(NOW_WED)).toEqual({ kind: "failed", reason: "작성 대상 명단이 비어 있습니다" });
  });
});

describe("sendRemind — 미제출 알림", () => {
  it("슬롯은 KST 날짜 + 정오/저녁 — cron 이 두 번 불려도 한 번", () => {
    expect(remindSlotOf(new Date("2026-11-19T03:00:00Z"))).toBe("remind:2026-11-19:noon");
    expect(remindSlotOf(new Date("2026-11-19T08:00:00Z"))).toBe("remind:2026-11-19:evening");
  });

  it("미제출자에게만, 받은 슬롯으로", async () => {
    const r = await sendRemind(new Date("2026-11-19T03:00:00Z"));
    const t = m.deliverNotices.mock.calls[0][0];
    expect(t).toMatchObject({ kind: "remind", slot: "remind:2026-11-19:noon" });
    expect(t.mails.map((x: { to: string }) => x.to)).toEqual(["b@x"]);
    expect(r.kind).toBe("sent");
  });

  it("전원 제출이면 보내지 않는다(스킵)", async () => {
    m.listPendingWriters.mockResolvedValue([]);
    expect(await sendRemind(new Date("2026-11-19T03:00:00Z"))).toEqual({
      kind: "skipped",
      reason: "모두 제출했습니다",
    });
  });

  it("수동 알림은 주를 받아 그 주로, 슬롯을 따로 받는다", async () => {
    await sendRemind(new Date("2026-11-20T01:00:00Z"), { week: WEEK, slot: "manual:x" });
    expect(m.ensureWeek).not.toHaveBeenCalled();
    expect(m.deliverNotices.mock.calls[0][0].slot).toBe("manual:x");
  });
});
