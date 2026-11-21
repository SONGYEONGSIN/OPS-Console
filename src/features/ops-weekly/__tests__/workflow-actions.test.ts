import { describe, it, expect, vi, beforeEach } from "vitest";

const { emitSpy, snapshotSpy, ensureWeekSpy, remindSpy } = vi.hoisted(() => ({
  emitSpy: vi.fn(),
  snapshotSpy: vi.fn(),
  ensureWeekSpy: vi.fn(),
  remindSpy: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock(
  "@/lib/supabase/admin",
  async () => (await import("./actions-fixture")).adminModule,
);
vi.mock(
  "@/features/auth/queries",
  async () => (await import("./actions-fixture")).authModule,
);
vi.mock("../events", () => ({ emitOpsWeeklyEvent: emitSpy }));
vi.mock("../auto-queries", () => ({ loadAutoSnapshot: snapshotSpy }));
vi.mock("../notify/run", () => ({ sendRemind: remindSpy }));
vi.mock("../week-queries", async (orig) => ({
  ...(await orig<typeof import("../week-queries")>()),
  ensureWeek: ensureWeekSpy,
}));

import {
  finalizeWeek,
  remindPending,
  reopenWeek,
  returnReport,
  saveDutySummary,
  submitReport,
} from "../workflow-actions";
import { me, R, resetFixture, seed, state, W } from "./actions-fixture";
import type { Row } from "./fake-admin";
import { snap } from "@/app/dashboard/ops-weekly/__tests__/tab-fixtures";

const R2 = "66666666-6666-4666-8666-666666666666";
/** 최종 보고 때 새로 만든 값 / 그 전에 굳어 있던 값 — 스키마에 맞아야 null 로 안 읽힌다. */
const SNAP = snap();
const OLD = snap({ unknown: 1 });
const LOCKED = "보고가 끝난 주입니다. 관리자에게 정정을 요청하세요.";
const ALREADY = "이미 제출한 보고서입니다.";

const op = (email: string, name: string, role = "사원"): Row => ({
  email,
  name,
  team: "운영1팀",
  role,
  status: "active",
});

/** 명단(operators)과 함께 시드한다. */
function setup(opts: {
  report?: Row;
  week?: Row;
  writers?: Row[];
  extraReports?: Row[];
}) {
  seed(opts.report ?? {}, opts.week ?? {}, {
    operators: opts.writers ?? [],
    ops_weekly_reports: [],
  });
  // seed 가 만든 보고서를 유지하려고 다시 채운다.
  const base = seedReport(opts.report ?? {});
  state.db.rows("ops_weekly_reports").push(base, ...(opts.extraReports ?? []));
}

const seedReport = (over: Row): Row => ({
  id: R,
  week_id: W,
  operator_email: "a@x",
  status: "draft",
  submitted_at: null,
  returned_at: null,
  returned_by: null,
  return_reason: null,
  snapshot: null,
  checked_tabs: [],
  ...over,
});

const updates = (table: string) =>
  state.db.spies.update.mock.calls.filter(([t]) => t === table);

beforeEach(() => {
  resetFixture();
  snapshotSpy.mockResolvedValue(SNAP);
  ensureWeekSpy.mockResolvedValue(null);
  emitSpy.mockResolvedValue([]);
});

describe("submitReport", () => {
  it("제출은 스냅샷을 쓰지 않는다 — 자동 항목은 최종 보고 때 굳는다", async () => {
    me("a@x");
    setup({ writers: [op("a@x", "운영자A")] });
    expect(await submitReport({ reportId: R })).toEqual({ ok: true });
    expect(updates("ops_weekly_reports")[0][1]).toEqual(
      expect.objectContaining({ status: "submitted" }),
    );
    expect(updates("ops_weekly_reports")[0][1]).not.toHaveProperty("snapshot");
    expect(snapshotSpy).not.toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "all-submitted", weekId: W }),
    );
  });

  it("아직 미제출자가 있으면 all-submitted 는 없다", async () => {
    me("a@x");
    setup({ writers: [op("a@x", "운영자A"), op("b@x", "운영자B")] });
    expect(await submitReport({ reportId: R })).toEqual({ ok: true });
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("당번은 남의 보고서를 제출할 수 없다", async () => {
    me("d@x");
    setup({
      week: { duty_email: "d@x" },
      writers: [op("a@x", "운영자A")],
    });
    expect(await submitReport({ reportId: R })).toEqual({
      ok: false,
      error: "본인 보고서만 제출할 수 있습니다.",
    });
  });

  it("작성 대상이 아니면 거절한다", async () => {
    me("a@x");
    setup({ writers: [] });
    expect(await submitReport({ reportId: R })).toEqual({
      ok: false,
      error: "작성 대상이 아닙니다.",
    });
  });

  it("보고된 주는 locked 문구", async () => {
    me("a@x");
    setup({ week: { status: "reported" }, writers: [op("a@x", "운영자A")] });
    expect(await submitReport({ reportId: R })).toEqual({
      ok: false,
      error: LOCKED,
    });
  });

  it("이미 제출한 보고서는 다시 못 낸다 — 스냅샷도 이벤트도 없다", async () => {
    me("a@x");
    setup({
      report: { status: "submitted" },
      writers: [op("a@x", "운영자A")],
    });
    expect(await submitReport({ reportId: R })).toEqual({
      ok: false,
      error: ALREADY,
    });
    expect(snapshotSpy).not.toHaveBeenCalled();
    expect(updates("ops_weekly_reports")).toHaveLength(0);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("다시 작성 요청받은 보고서는 다시 낼 수 있다", async () => {
    me("a@x");
    setup({
      report: { status: "returned" },
      writers: [op("a@x", "운영자A")],
    });
    expect(await submitReport({ reportId: R })).toEqual({ ok: true });
  });

  it("낡은 화면 — 읽을 땐 draft 였지만 그 사이 제출됐다면 0행: 거절, 이벤트 없음", async () => {
    me("a@x");
    setup({ writers: [op("a@x", "운영자A")] });
    state.db.spies.update.mockImplementationOnce(() => {
      state.db.rows("ops_weekly_reports")[0].status = "submitted";
    });
    expect(await submitReport({ reportId: R })).toEqual({
      ok: false,
      error: ALREADY,
    });
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("두 번 클릭 — all-submitted 는 1회", async () => {
    me("a@x");
    setup({ writers: [op("a@x", "운영자A")] });
    await submitReport({ reportId: R });
    expect(await submitReport({ reportId: R })).toEqual({
      ok: false,
      error: ALREADY,
    });
    expect(
      emitSpy.mock.calls.filter(([e]) => e.type === "all-submitted"),
    ).toHaveLength(1);
  });

  it("보고서 id 가 uuid 가 아니면 거절한다", async () => {
    me("a@x");
    setup({ writers: [op("a@x", "운영자A")] });
    expect((await submitReport({ reportId: "x" })).ok).toBe(false);
  });
});

describe("returnReport", () => {
  it("다시 작성 — 스냅샷은 두고 report-returned", async () => {
    me("d@x");
    setup({
      report: { status: "submitted", snapshot: SNAP },
      week: { duty_email: "d@x" },
    });
    expect(await returnReport({ reportId: R, reason: "건수 확인" })).toEqual({
      ok: true,
    });
    expect(updates("ops_weekly_reports")[0][1]).toEqual(
      expect.objectContaining({
        status: "returned",
        return_reason: "건수 확인",
        returned_by: "d@x",
      }),
    );
    expect(updates("ops_weekly_reports")[0][1]).not.toHaveProperty("snapshot");
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "report-returned",
        operatorEmail: "a@x",
        returnedBy: "d@x",
        reason: "건수 확인",
      }),
    );
  });

  it("일반 사용자는 못 한다", async () => {
    me("a@x");
    setup({ report: { status: "submitted" }, week: { duty_email: "d@x" } });
    expect(await returnReport({ reportId: R })).toEqual({
      ok: false,
      error: "당번 또는 관리자만 할 수 있습니다.",
    });
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("다시 작성 요청은 굳은 스냅샷을 지우지 않는다(정정 주 포함)", async () => {
    me("d@x");
    setup({
      week: { duty_email: "d@x", reopened_at: "2026-11-20T01:00:00Z" },
      report: { status: "submitted", snapshot: OLD },
      writers: [op("a@x", "운영자A")],
    });
    expect((await returnReport({ reportId: R })).ok).toBe(true);
    expect(updates("ops_weekly_reports")[0][1]).not.toHaveProperty("snapshot");
    expect(state.db.rows("ops_weekly_reports")[0].snapshot).toEqual(OLD);
  });

  it("제출 전 보고서는 다시 작성 요청할 수 없다", async () => {
    me("d@x");
    setup({ report: { status: "draft" }, week: { duty_email: "d@x" } });
    expect((await returnReport({ reportId: R })).ok).toBe(false);
    expect(emitSpy).not.toHaveBeenCalled();
  });
});

describe("saveDutySummary", () => {
  const input = { weekId: W, thisWeek: "금주", nextWeek: "차주" };

  it("당번은 저장한다", async () => {
    me("d@x");
    setup({ week: { duty_email: "d@x" } });
    expect(await saveDutySummary(input)).toEqual({ ok: true });
    expect(updates("ops_weekly_weeks")[0][1]).toEqual({
      summary_this: "금주",
      summary_next: "차주",
    });
  });

  it("당번도 admin 도 아니면 거절", async () => {
    me("a@x");
    setup({ week: { duty_email: "d@x" } });
    expect(await saveDutySummary(input)).toEqual({
      ok: false,
      error: "당번 또는 관리자만 할 수 있습니다.",
    });
  });

  it("4000자 초과는 거절", async () => {
    me("d@x");
    setup({ week: { duty_email: "d@x" } });
    expect(
      (await saveDutySummary({ ...input, thisWeek: "가".repeat(4001) })).ok,
    ).toBe(false);
  });
});

describe("finalizeWeek", () => {
  const allSubmitted = (week: Row = {}) => {
    me("d@x");
    setup({
      week: { duty_email: "d@x", ...week },
      writers: [op("a@x", "운영자A")],
      report: { status: "submitted" },
    });
  };

  it("미제출자가 있으면 이름과 함께 거절", async () => {
    me("d@x");
    setup({
      week: { duty_email: "d@x" },
      writers: [op("a@x", "운영자A"), op("b@x", "운영자B")],
      report: { status: "submitted" },
    });
    expect(await finalizeWeek({ weekId: W })).toEqual({
      ok: false,
      error: "아직 제출하지 않은 사람이 있습니다: 운영자B",
    });
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("명단이 비면 켜지지 않는다", async () => {
    me("d@x");
    setup({ week: { duty_email: "d@x" }, writers: [] });
    expect(await finalizeWeek({ weekId: W })).toEqual({
      ok: false,
      error: "작성 대상 명단을 읽지 못했습니다. 관리자 설정을 확인하세요.",
    });
  });

  it("명단 조회가 실패하면 던진다 — 최종 보고는 일어나지 않는다", async () => {
    me("d@x");
    setup({ week: { duty_email: "d@x" }, writers: [] });
    state.db.failTable("operators", "db down");
    await expect(finalizeWeek({ weekId: W })).rejects.toThrow(/db down/);
    expect(updates("ops_weekly_weeks")).toHaveLength(0);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("당번도 admin 도 아니면 forbidden", async () => {
    me("a@x");
    setup({
      week: { duty_email: "d@x" },
      writers: [op("a@x", "운영자A")],
      report: { status: "submitted" },
    });
    expect(await finalizeWeek({ weekId: W })).toEqual({
      ok: false,
      error: "당번 또는 관리자만 할 수 있습니다.",
    });
  });

  it("이미 보고된 주는 locked", async () => {
    allSubmitted({ status: "reported" });
    expect(await finalizeWeek({ weekId: W })).toEqual({
      ok: false,
      error: LOCKED,
    });
  });

  it("낡은 화면 — 굳힌 뒤 주 전환 직전에 다른 요청이 보고했다면 0행: 이미 보고된 주, 이벤트 없음", async () => {
    allSubmitted();
    // 주 전환 update 에서만 경쟁을 흉내낸다(스냅샷 쓰기는 그대로 둔다).
    state.db.spies.update.mockImplementation((table: string) => {
      if (table === "ops_weekly_weeks") {
        state.db.rows("ops_weekly_weeks")[0].status = "reported";
      }
    });
    expect(await finalizeWeek({ weekId: W })).toEqual({
      ok: false,
      error: "이미 보고된 주입니다.",
    });
    expect(emitSpy).not.toHaveBeenCalled();
    expect(ensureWeekSpy).not.toHaveBeenCalled();
  });

  it("두 번 클릭 — week-reported 는 1회", async () => {
    allSubmitted();
    await finalizeWeek({ weekId: W });
    await finalizeWeek({ weekId: W });
    expect(
      emitSpy.mock.calls.filter(([e]) => e.type === "week-reported"),
    ).toHaveLength(1);
  });

  it("성공 — week-reported(correction=false) + 다음 주 열기", async () => {
    allSubmitted();
    expect(await finalizeWeek({ weekId: W })).toEqual({ ok: true });
    expect(updates("ops_weekly_weeks")[0][1]).toEqual(
      expect.objectContaining({ status: "reported", reported_by: "d@x" }),
    );
    expect(emitSpy).toHaveBeenCalledWith({
      type: "week-reported",
      weekId: W,
      weekStart: "2026-11-16",
      reportedBy: "d@x",
      correction: false,
    });
    expect(ensureWeekSpy).toHaveBeenCalledWith("2026-11-23");
  });

  it("정정 후 다시 보고하면 correction=true", async () => {
    allSubmitted({ reopened_at: "2026-11-20T01:00:00Z" });
    await finalizeWeek({ weekId: W });
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ correction: true }),
    );
  });

  it("다음 주 열기가 실패해도 보고는 성공이다", async () => {
    allSubmitted();
    ensureWeekSpy.mockRejectedValue(new Error("x"));
    expect(await finalizeWeek({ weekId: W })).toEqual({ ok: true });
  });
});

describe("finalizeWeek — 자동 항목 굳히기", () => {
  /** 두 사람 다 제출한 주. a 는 R, b 는 R2. */
  const twoSubmitted = (opts: { week?: Row; a?: Row; b?: Row } = {}) => {
    me("d@x");
    setup({
      week: { duty_email: "d@x", ...opts.week },
      report: { status: "submitted", ...opts.a },
      writers: [op("a@x", "운영자A"), op("b@x", "운영자B")],
      extraReports: [
        seedReport({
          id: R2,
          operator_email: "b@x",
          status: "submitted",
          ...opts.b,
        }),
      ],
    });
  };
  const snapWrites = () =>
    updates("ops_weekly_reports").filter(([, p]) => "snapshot" in p);
  const snapshotOf = (id: string) =>
    state.db.rows("ops_weekly_reports").find((r) => r.id === id)?.snapshot;

  it("최종 보고는 전원 스냅샷을 쓴 뒤에 week-reported 를 낸다", async () => {
    twoSubmitted();
    expect(await finalizeWeek({ weekId: W })).toEqual({ ok: true });
    expect(snapWrites()).toHaveLength(2);
    expect(snapshotSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        weekStart: "2026-11-16",
        operatorEmail: "b@x",
        operatorName: "운영자B",
        writerNames: new Set(["운영자A", "운영자B"]),
      }),
    );
    const { calls, invocationCallOrder } = state.db.spies.update.mock;
    const lastSnapWrite = Math.max(
      ...calls.flatMap(([t], i) =>
        t === "ops_weekly_reports" ? [invocationCallOrder[i]] : [],
      ),
    );
    expect(emitSpy.mock.invocationCallOrder[0]).toBeGreaterThan(lastSnapWrite);
    const weekFlip = calls.findIndex(([t]) => t === "ops_weekly_weeks");
    expect(invocationCallOrder[weekFlip]).toBeGreaterThan(lastSnapWrite);
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "week-reported", correction: false }),
    );
  });

  it("굳히기는 사람이 쓴 게 아니다 — updated_by 를 바꾸지 않는다", async () => {
    twoSubmitted();
    await finalizeWeek({ weekId: W });
    snapWrites().forEach(([, p]) => expect(p).toEqual({ snapshot: SNAP }));
  });

  it("한 사람이라도 굳히기에 실패하면 주는 open 이고 이벤트가 없다 — 다시 누르면 처음부터", async () => {
    snapshotSpy
      .mockResolvedValueOnce(SNAP)
      .mockRejectedValueOnce(new Error("closing 조회 실패"));
    twoSubmitted();
    const r = await finalizeWeek({ weekId: W });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toBe(
      "자동 항목을 굳히지 못해 최종 보고를 멈췄습니다. 다시 눌러 주세요: closing 조회 실패",
    );
    expect(updates("ops_weekly_weeks")).toHaveLength(0);
    expect(emitSpy).not.toHaveBeenCalled();
    expect(updates("ops_weekly_reports")).toHaveLength(0); // 다 만든 뒤에만 쓴다
    expect(state.db.rows("ops_weekly_weeks")[0].status).toBe("open");

    snapshotSpy.mockResolvedValue(SNAP);
    expect(await finalizeWeek({ weekId: W })).toEqual({ ok: true });
    expect(snapWrites()).toHaveLength(2);
    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it("스냅샷 저장이 실패해도 보고하지 않는다", async () => {
    twoSubmitted();
    state.db.failNextWrite("ops_weekly_reports", "write down");
    const r = await finalizeWeek({ weekId: W });
    expect(r.ok === false && r.error).toMatch(
      /^자동 항목을 굳히지 못해 최종 보고를 멈췄습니다.*write down/,
    );
    expect(updates("ops_weekly_weeks")).toHaveLength(0);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("일반 주 — 한 장 쓰고 두 번째에서 실패하면 open·이벤트 없음, 다시 누르면 전원을 새 시각으로 다시 굳힌다", async () => {
    twoSubmitted();
    let reportWrites = 0;
    state.db.spies.update.mockImplementation((table: string) => {
      if (table !== "ops_weekly_reports") return;
      reportWrites += 1;
      if (reportWrites === 2) {
        state.db.failNextWrite("ops_weekly_reports", "write down");
      }
    });
    const r = await finalizeWeek({ weekId: W });
    expect(r.ok === false && r.error).toMatch(
      /^자동 항목을 굳히지 못해 최종 보고를 멈췄습니다.*write down/,
    );
    expect(snapshotOf(R)).toEqual(SNAP);
    expect(snapshotOf(R2)).toBeNull();
    expect(state.db.rows("ops_weekly_weeks")[0].status).toBe("open");
    expect(emitSpy).not.toHaveBeenCalled();

    const LATER = { ...snap(), computedAt: "2026-11-20T02:00:00.000Z" };
    snapshotSpy.mockResolvedValue(LATER);
    expect(await finalizeWeek({ weekId: W })).toEqual({ ok: true });
    expect(snapshotOf(R)).toEqual(LATER);
    expect(snapshotOf(R2)).toEqual(LATER);
    expect(state.db.rows("ops_weekly_weeks")[0].status).toBe("reported");
    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it("정정 주 — 그 사이 다른 요청이 굳혀 0행이면 오류가 아니고 그 값을 둔다", async () => {
    twoSubmitted({ week: { reopened_at: "2026-11-20T01:00:00Z" } });
    const OTHER = snap({ unknown: 3 });
    // 우리가 읽을 땐 비어 있었지만, 쓰기 직전에 다른 [최종 보고] 가 R 을 굳혔다.
    state.db.spies.update.mockImplementationOnce(() => {
      state.db.rows("ops_weekly_reports")[0].snapshot = OTHER;
    });
    expect(await finalizeWeek({ weekId: W })).toEqual({ ok: true });
    expect(snapshotOf(R)).toEqual(OTHER);
    expect(snapshotOf(R2)).toEqual(SNAP);
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "week-reported", correction: true }),
    );
  });

  it("첫 최종 보고는 제출 때 굳은 옛 스냅샷도 덮어 쓴다", async () => {
    twoSubmitted({ a: { snapshot: OLD } });
    expect(await finalizeWeek({ weekId: W })).toEqual({ ok: true });
    expect(snapWrites()).toHaveLength(2);
    expect(snapshotOf(R)).toEqual(SNAP);
    expect(snapshotOf(R2)).toEqual(SNAP);
  });

  it("정정 뒤 재보고는 굳은 값을 두고 빈 것만 채운다", async () => {
    twoSubmitted({
      week: { reopened_at: "2026-11-20T01:00:00Z" },
      a: { snapshot: OLD },
    });
    expect(await finalizeWeek({ weekId: W })).toEqual({ ok: true });
    expect(snapshotSpy).toHaveBeenCalledTimes(1);
    expect(snapWrites()).toHaveLength(1);
    expect(snapshotOf(R)).toEqual(OLD);
    expect(snapshotOf(R2)).toEqual(SNAP);
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "week-reported", correction: true }),
    );
  });

  it("작성 대상 명단에 없는 사람의 보고서는 굳히지 않는다", async () => {
    me("d@x");
    setup({
      week: { duty_email: "d@x" },
      report: { status: "submitted" },
      writers: [op("a@x", "운영자A")],
      extraReports: [
        seedReport({ id: R2, operator_email: "gone@x", status: "submitted" }),
      ],
    });
    expect(await finalizeWeek({ weekId: W })).toEqual({ ok: true });
    expect(snapshotOf(R)).toEqual(SNAP);
    expect(snapshotOf(R2)).toBeNull();
    expect(snapshotSpy).toHaveBeenCalledTimes(1);
  });
});

describe("reopenWeek", () => {
  it("정정은 admin 만", async () => {
    me("d@x", false);
    setup({ week: { status: "reported", duty_email: "d@x" } });
    expect((await reopenWeek({ weekId: W })).ok).toBe(false);
    expect(updates("ops_weekly_weeks")).toHaveLength(0);
  });

  it("admin 은 보고된 주를 다시 연다 — 보고서·스냅샷은 그대로, 이벤트 없음", async () => {
    me("adm@x", true);
    setup({
      week: { status: "reported" },
      report: { status: "submitted", snapshot: SNAP },
    });
    expect(await reopenWeek({ weekId: W })).toEqual({ ok: true });
    expect(updates("ops_weekly_weeks")[0][1]).toEqual(
      expect.objectContaining({ status: "open", reopened_by: "adm@x" }),
    );
    expect(updates("ops_weekly_reports")).toHaveLength(0);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("열린 주는 정정할 수 없다", async () => {
    me("adm@x", true);
    setup({});
    expect((await reopenWeek({ weekId: W })).ok).toBe(false);
  });
});

describe("remindPending — 당번의 [미제출자에게 알림]", () => {
  const TALLY = { sent: 2, failed: 0, dryRun: 0, skipped: 0, errors: [] };
  beforeEach(() => {
    remindSpy.mockReset().mockResolvedValue({ kind: "sent", tally: TALLY });
  });

  it("당번이 누르면 그 주로 새 슬롯을 만들어 보내고 몇 명에게 갔는지 돌려준다", async () => {
    me("d@x");
    setup({ week: { duty_email: "d@x" }, writers: [op("a@x", "운영자A")] });
    expect(await remindPending({ weekId: W })).toEqual({ ok: true, message: "2명에게 알렸습니다" });
    const [, manual] = remindSpy.mock.calls[0];
    expect(manual.week.id).toBe(W);
    expect(manual.slot).toMatch(/^manual:/);
  });

  it("당번도 관리자도 아니면 거절", async () => {
    me("a@x");
    setup({ week: { duty_email: "d@x" }, writers: [op("a@x", "운영자A")] });
    expect(await remindPending({ weekId: W })).toEqual({
      ok: false,
      error: "당번 또는 관리자만 할 수 있습니다.",
    });
    expect(remindSpy).not.toHaveBeenCalled();
  });

  it("보고된 주는 거절", async () => {
    me("d@x");
    setup({ week: { duty_email: "d@x", status: "reported" }, writers: [] });
    expect(await remindPending({ weekId: W })).toEqual({
      ok: false,
      error: "보고가 끝난 주입니다. 관리자에게 정정을 요청하세요.",
    });
  });

  it("모두 냈으면 그렇게 알린다, 발송 실패는 실패로", async () => {
    me("d@x");
    setup({ week: { duty_email: "d@x" }, writers: [] });
    remindSpy.mockResolvedValue({ kind: "skipped", reason: "모두 제출했습니다" });
    expect(await remindPending({ weekId: W })).toEqual({ ok: true, message: "모두 제출했습니다" });
    remindSpy.mockResolvedValue({
      kind: "sent",
      tally: { ...TALLY, sent: 1, failed: 1, errors: ["b@x: 403"] },
    });
    expect(await remindPending({ weekId: W })).toEqual({
      ok: false,
      error: "1명에게 알렸지만 1명은 실패했습니다: b@x: 403",
    });
  });
});
