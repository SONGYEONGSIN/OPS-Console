/**
 * `_load` 의 열람 판정 — 누구의 보고서를, 어떤 탭으로, 무엇을 읽는가.
 * 권한 없는 탭의 데이터는 읽지 않는다(목이 모두 vi.fn 이라 '안 읽었다'를 단언한다).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CurrentOperator } from "@/features/auth/queries";
import type { WeekRow } from "@/features/ops-weekly/schemas";
import { EMPTY, snap } from "./tab-fixtures";

const m = vi.hoisted(() => ({
  getWeek: vi.fn(),
  ensureWeek: vi.fn(),
  listWriters: vi.fn(),
  listRecentWeeks: vi.fn(),
  ensureReport: vi.fn(),
  listReports: vi.fn(),
  loadReportDetail: vi.fn(),
  loadReportDetails: vi.fn(),
  loadAutoSnapshots: vi.fn(),
  listProjectEntriesForWeek: vi.fn(),
  listReportStatusesForWeeks: vi.fn(),
  loadSettingsBundle: vi.fn(),
  isRecipient: vi.fn(),
  loadAutoSnapshot: vi.fn(),
  loadUnmatchedServices: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/ops-weekly/week-queries", () => ({
  getWeek: m.getWeek,
  ensureWeek: m.ensureWeek,
  listWriters: m.listWriters,
  listRecentWeeks: m.listRecentWeeks,
}));
vi.mock("@/features/ops-weekly/report-queries", () => ({
  ensureReport: m.ensureReport,
  listReports: m.listReports,
  loadReportDetail: m.loadReportDetail,
  loadReportDetails: m.loadReportDetails,
  listProjectEntriesForWeek: m.listProjectEntriesForWeek,
  listReportStatusesForWeeks: m.listReportStatusesForWeeks,
}));
vi.mock("@/features/ops-weekly/settings-queries", () => ({
  loadSettingsBundle: m.loadSettingsBundle,
  isRecipient: m.isRecipient,
}));
vi.mock("@/features/ops-weekly/auto-queries", () => ({
  loadAutoSnapshot: m.loadAutoSnapshot,
  loadAutoSnapshots: m.loadAutoSnapshots,
  loadUnmatchedServices: m.loadUnmatchedServices,
}));
vi.mock("@/features/ops-weekly/note-images", () => ({
  signProjectEntries: async <T>(entries: T) => entries,
}));

import { loadOpsWeeklyPage } from "../_load";

const WEEK: WeekRow = {
  id: "w1",
  week_start: "2026-11-16",
  label_year: 2026,
  label_month: 11,
  label_week: 3,
  duty_email: "d@x",
  summary_this: "",
  summary_next: "",
  status: "open",
  reported_at: null,
  reported_by: null,
  reopened_at: null,
  reopened_by: null,
};
const writer = (email: string, name: string) => ({
  email,
  name,
  team: "운영1팀",
  role: "사원",
  status: "active",
});
const reportFor = (weekId: string, email: string) => ({
  id: `r-${email}`,
  week_id: weekId,
  operator_email: email,
  status: "draft",
  submitted_at: null,
  returned_at: null,
  returned_by: null,
  return_reason: null,
  snapshot: null,
  checked_tabs: [],
});
/** getWeek(이번 주·지난주 조회)과 ensureWeek(보는 주) 모두 같은 행을 준다 */
function getWeekMock(over: Partial<WeekRow> = {}) {
  const week = { ...WEEK, ...over };
  m.getWeek.mockResolvedValue(week);
  m.ensureWeek.mockResolvedValue(week);
}
const isRecipientMock = (v: boolean) => m.isRecipient.mockResolvedValue(v);
const REPORTED = {
  status: "reported",
  reported_at: "2026-11-20T08:00:00Z",
} as const;

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  getWeekMock();
  m.listWriters.mockResolvedValue([
    writer("a@x", "홍길동"),
    writer("b@x", "김철수"),
  ]);
  m.ensureReport.mockImplementation(async (weekId: string, email: string) =>
    reportFor(weekId, email),
  );
  m.listReports.mockResolvedValue([]);
  m.loadReportDetail.mockResolvedValue(EMPTY);
  m.listProjectEntriesForWeek.mockResolvedValue([]);
  m.listRecentWeeks.mockResolvedValue([]);
  m.listReportStatusesForWeeks.mockResolvedValue([]);
  m.loadSettingsBundle.mockResolvedValue({ marker: "bundle" });
  isRecipientMock(false);
  m.loadAutoSnapshot.mockResolvedValue(snap());
  m.loadUnmatchedServices.mockResolvedValue({ application: [], pims: [] });
  m.loadAutoSnapshots.mockImplementation(
    async ({ writers }: { writers: { email: string }[] }) =>
      new Map(writers.map((w) => [w.email, snap()])),
  );
  m.loadReportDetails.mockImplementation(
    async (reports: { id: string }[]) => new Map(reports.map((r) => [r.id, EMPTY])),
  );
});

const load = (
  email: string,
  permission: "member" | "admin",
  sp: Record<string, string>,
) =>
  loadOpsWeeklyPage(
    { email, permission } as CurrentOperator,
    sp,
    new Date("2026-11-18T03:00:00Z"),
  );

/** 안내 화면이면 보고서·목록·탭 데이터를 하나도 읽지 않았다 */
function expectNothingRead() {
  expect(m.ensureReport).not.toHaveBeenCalled();
  expect(m.listReports).not.toHaveBeenCalled();
  expect(m.loadAutoSnapshot).not.toHaveBeenCalled();
  expect(m.loadReportDetail).not.toHaveBeenCalled();
  expect(m.listProjectEntriesForWeek).not.toHaveBeenCalled();
  expect(m.loadSettingsBundle).not.toHaveBeenCalled();
}

describe("loadOpsWeeklyPage — 열람 판정", () => {
  it("일반 운영자: ?tab=status&op=b 여도 본인 원서접수, 남의 데이터는 읽지 않는다", async () => {
    const v = await load("a@x", "member", { tab: "status", op: "b@x" });
    expect(v).toMatchObject({
      kind: "week",
      tab: "application",
      viewed: { email: "a@x" },
      roles: ["report"],
      statusAccess: null,
      reports: null,
      bundle: null,
      overview: null,
    });
    expect(m.listProjectEntriesForWeek).not.toHaveBeenCalled();
    expect(m.loadSettingsBundle).not.toHaveBeenCalled();
    expect(m.ensureReport).not.toHaveBeenCalledWith("w1", "b@x");
  });

  it("일반 운영자: ?tab=settings 도 원서접수", async () => {
    const v = await load("a@x", "member", { tab: "settings" });
    expect(v).toMatchObject({
      kind: "week",
      tab: "application",
      viewed: { email: "a@x" },
      bundle: null,
      unmatched: null,
      overview: null,
    });
    expect(m.loadSettingsBundle).not.toHaveBeenCalled();
    expect(m.loadUnmatchedServices).not.toHaveBeenCalled();
    expect(m.listRecentWeeks).not.toHaveBeenCalled();
  });

  it("RF4 그 주 당번(명단 밖): ?op=B@X 는 b 의 보고서(탭 줄에 내 보고서 없음), 명단 밖 op 는 제출 현황", async () => {
    expect(await load("d@x", "member", { op: "B@X" })).toMatchObject({
      tab: "application",
      viewed: { email: "b@x" },
      roles: ["status"],
    });
    expect(await load("d@x", "member", { op: "x@x" })).toMatchObject({
      tab: "status",
      viewed: null,
      roles: ["status"],
    });
    // 명단 안의 당번이 명단 밖 op 로 열면 본인 보고서로 떨어진다(null 이 아니다)
    getWeekMock({ duty_email: "a@x" });
    expect(await load("a@x", "member", { op: "x@x" })).toMatchObject({
      tab: "application",
      viewed: { email: "a@x" },
    });
  });

  it("당번이 아닌 주의 명단 밖 당번은 안내 화면 — 받는 사람 조회도 안 한다(열린 주)", async () => {
    getWeekMock({ duty_email: "e@x" });
    expect(await load("d@x", "member", {})).toMatchObject({
      kind: "no-access",
      emptyRoster: false,
    });
    expect(m.isRecipient).not.toHaveBeenCalled();
    expectNothingRead();
  });

  it("받는 사람: 보고된 주의 ?tab=status 는 읽기 전용 제출 현황", async () => {
    getWeekMock(REPORTED);
    isRecipientMock(true);
    const v = await load("r@x", "member", {
      week: "2026-11-16",
      tab: "status",
    });
    expect(v).toMatchObject({
      kind: "week",
      tab: "status",
      statusAccess: "read",
      roles: ["status"],
    });
    expect(m.isRecipient).toHaveBeenCalledWith("r@x");
  });

  it("받는 사람: 보고된 주의 [보기](?op=B@X)는 b 의 보고서를 읽기 전용으로 연다", async () => {
    getWeekMock(REPORTED);
    isRecipientMock(true);
    m.listReports.mockResolvedValue([
      { ...reportFor("w1", "b@x"), status: "submitted" },
    ]);
    const v = await load("r@x", "member", { week: "2026-11-16", op: "B@X" });
    expect(v).toMatchObject({
      kind: "week",
      tab: "application",
      viewed: { email: "b@x" },
      report: { id: "r-b@x" },
      statusAccess: "read",
      roles: ["status"],
      canEdit: false,
    });
    // 보고가 끝난 주라 보고서를 새로 만들지 않는다
    expect(m.ensureReport).not.toHaveBeenCalled();
  });

  it("받는 사람: 열린 주는 안내 화면", async () => {
    isRecipientMock(true);
    const v = await load("r@x", "member", {
      week: "2026-11-16",
      tab: "status",
    });
    expect(v).toMatchObject({ kind: "no-access", emptyRoster: false });
    // 열린 주에서는 받는 사람인지 물을 까닭이 없다(보고가 끝난 주만 읽는다)
    expect(m.isRecipient).not.toHaveBeenCalled();
    expectNothingRead();
    // 정정으로 다시 연 주도 open 이라 마찬가지다(보고가 끝난 주만)
    getWeekMock({
      reported_at: "2026-11-20T08:00:00Z",
      reopened_at: "2026-11-21T01:00:00Z",
      reopened_by: "z@x",
    });
    expect(
      await load("r@x", "member", { week: "2026-11-16", tab: "status" }),
    ).toMatchObject({ kind: "no-access", emptyRoster: false });
    expect(m.isRecipient).not.toHaveBeenCalled();
  });

  it("명단 밖 관리자: 기본은 제출 현황, ?tab=settings 는 번들·안 붙은 서비스·전체 현황을 읽는다", async () => {
    expect(await load("z@x", "admin", {})).toMatchObject({
      tab: "status",
      roles: ["status", "manage"],
    });
    m.listRecentWeeks.mockResolvedValue([WEEK]);
    const s = await load("z@x", "admin", { tab: "settings" });
    expect(s).toMatchObject({ tab: "settings" });
    expect(m.loadSettingsBundle).toHaveBeenCalledTimes(1);
    expect(m.loadUnmatchedServices).toHaveBeenCalledTimes(1);
    expect(m.listRecentWeeks).toHaveBeenCalledWith(8);
    expect(m.listReportStatusesForWeeks).toHaveBeenCalledWith(["w1"]);
  });

  it("관리 › 전체 현황: 보는 주가 최근 8주 밖이면 끝에 덧붙이고 제출 수도 함께 읽는다", async () => {
    const recent = Array.from({ length: 8 }, (_, i) => ({
      ...WEEK,
      id: `r${i}`,
      week_start: `2027-0${i + 1}-04`,
    }));
    m.listRecentWeeks.mockResolvedValue(recent);
    const v = await load("z@x", "admin", { tab: "settings" });
    const ids = v.kind === "week" ? (v.overview ?? []).map((r) => r.weekId) : [];
    expect(ids).toHaveLength(9);
    expect(ids.at(-1)).toBe("w1");
    expect(m.listReportStatusesForWeeks).toHaveBeenCalledWith([
      ...recent.map((w) => w.id),
      "w1",
    ]);
  });

  it("관리 › 전체 현황: 보는 주가 최근 8주 안이면 중복 없이 8개", async () => {
    const recent = [
      ...Array.from({ length: 7 }, (_, i) => ({
        ...WEEK,
        id: `r${i}`,
        week_start: `2027-0${i + 1}-04`,
      })),
      WEEK,
    ];
    m.listRecentWeeks.mockResolvedValue(recent);
    const v = await load("z@x", "admin", { tab: "settings" });
    const ids = v.kind === "week" ? (v.overview ?? []).map((r) => r.weekId) : [];
    expect(ids).toEqual(recent.map((w) => w.id));
    expect(m.listReportStatusesForWeeks).toHaveBeenCalledWith(
      recent.map((w) => w.id),
    );
  });

  it("명단 밖 관리자가 ?op=작성자 로 열면 그 보고서를 보되 탭은 제출 현황·관리 둘", async () => {
    expect(await load("z@x", "admin", { op: "b@x" })).toMatchObject({
      tab: "application",
      viewed: { email: "b@x" },
      roles: ["status", "manage"],
    });
  });

  it("역할 없음·보고된 주·받는 사람 아님 → 안내 화면", async () => {
    // 명단 밖(q@x)·관리자 아님·당번(d@x) 아님 — 명단 안 사람이면 본인 보고서가 열린다
    getWeekMock(REPORTED);
    isRecipientMock(false);
    const v = await load("q@x", "member", { week: "2026-11-16" });
    expect(v).toMatchObject({ kind: "no-access", emptyRoster: false });
    expect(m.isRecipient).toHaveBeenCalledWith("q@x");
    expectNothingRead();
  });

  it("명단 0명의 일반 운영자 → 안내 화면(emptyRoster)", async () => {
    m.listWriters.mockResolvedValue([]);
    const v = await load("a@x", "member", {});
    expect(v).toMatchObject({ kind: "no-access", emptyRoster: true });
    expectNothingRead();
  });

  it("작성자이면서 당번이 제출 현황을 열어도 스냅샷·KPI 를 읽지 않는다", async () => {
    getWeekMock({ duty_email: "a@x" }); // 보는 사람이 있어야 '탭 때문에 안 읽는다'가 드러난다
    const v = await load("a@x", "member", { tab: "status" });
    expect(v).toMatchObject({
      kind: "week",
      tab: "status",
      viewed: { email: "a@x" },
      roles: ["report", "status"],
      statusAccess: "manage",
      kpis: null,
      snapshot: null,
      detail: null,
    });
    expect(m.loadAutoSnapshot).not.toHaveBeenCalled();
    expect(m.loadReportDetail).not.toHaveBeenCalled();
  });

  it("전체 보고(?op=all): 작성자는 전원 스냅샷을 한 번에 읽고, 본인 보고서를 만들지 않는다", async () => {
    const v = await load("a@x", "member", { op: "all" });
    expect(v).toMatchObject({
      kind: "week",
      tab: "application",
      viewed: null,
      report: null,
      roles: ["report"],
      canEdit: false,
      canSubmit: false,
    });
    expect(v.kind === "week" && v.all !== null).toBe(true);
    expect(m.loadAutoSnapshots).toHaveBeenCalledTimes(1);
    expect(m.loadAutoSnapshots.mock.calls[0][0].writers.map((w: { email: string }) => w.email)).toEqual(["a@x", "b@x"]);
    expect(m.loadAutoSnapshot).not.toHaveBeenCalled();
    expect(m.ensureReport).not.toHaveBeenCalled();
  });

  it("전체 보고: 이미 굳은 보고서는 그 스냅샷을 쓰고 새로 계산하지 않는다", async () => {
    const frozen = { ...reportFor("w1", "b@x"), snapshot: snap() };
    m.listReports.mockResolvedValue([frozen]);
    await load("a@x", "member", { op: "all" });
    const asked = m.loadAutoSnapshots.mock.calls[0][0].writers.map((w: { email: string }) => w.email);
    expect(asked).toEqual(["a@x"]);
    expect(m.loadReportDetails).toHaveBeenCalledWith([frozen]);
  });

  it("전체 보고: 명단 밖 관리자도 연다(탭 줄은 제출 현황·관리)", async () => {
    const v = await load("z@x", "admin", { op: "all" });
    expect(v).toMatchObject({ tab: "application", viewed: null, roles: ["status", "manage"] });
    expect(v.kind === "week" && v.all !== null).toBe(true);
  });

  it("전체 보고: 작성자도 당번도 관리자도 아니면 안내 화면", async () => {
    getWeekMock(REPORTED);
    const v = await load("q@x", "member", { op: "all" });
    expect(v).toMatchObject({ kind: "no-access" });
  });

  it("전체 보고라도 제출 현황 탭이면 전원 스냅샷을 읽지 않는다", async () => {
    getWeekMock({ duty_email: "a@x" });
    const v = await load("a@x", "member", { tab: "status", op: "all" });
    expect(v).toMatchObject({ tab: "status", all: null });
    expect(m.loadAutoSnapshots).not.toHaveBeenCalled();
  });
});
