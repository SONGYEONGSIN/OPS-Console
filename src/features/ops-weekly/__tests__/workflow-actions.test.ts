import { describe, it, expect, vi, beforeEach } from "vitest";

const { emitSpy, snapshotSpy, ensureWeekSpy } = vi.hoisted(() => ({
  emitSpy: vi.fn(),
  snapshotSpy: vi.fn(),
  ensureWeekSpy: vi.fn(),
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
vi.mock("../week-queries", async (orig) => ({
  ...(await orig<typeof import("../week-queries")>()),
  ensureWeek: ensureWeekSpy,
}));

import {
  finalizeWeek,
  reopenWeek,
  returnReport,
  saveDutySummary,
  submitReport,
} from "../workflow-actions";
import { me, R, resetFixture, seed, state, W } from "./actions-fixture";
import type { Row } from "./fake-admin";

const SNAP = { version: 1, marker: "snap" };
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
  it("제출은 스냅샷을 굳히고, 마지막 제출이면 all-submitted 를 낸다", async () => {
    me("a@x");
    setup({ writers: [op("a@x", "운영자A")] });
    expect(await submitReport({ reportId: R })).toEqual({ ok: true });
    expect(updates("ops_weekly_reports")[0][1]).toEqual(
      expect.objectContaining({ status: "submitted", snapshot: SNAP }),
    );
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
  it("다시 작성 — 스냅샷을 비우고 report-returned", async () => {
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
        snapshot: null,
        return_reason: "건수 확인",
        returned_by: "d@x",
      }),
    );
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

  it("낡은 화면 — 조건부 전환이 0행이면 이미 보고된 주, 이벤트 없음", async () => {
    allSubmitted();
    state.db.spies.update.mockImplementationOnce(() => {
      state.db.rows("ops_weekly_weeks")[0].status = "reported";
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
