/**
 * `_load` 의 자동 항목 읽는 규칙(특성 고정) — 스냅샷이 있으면 그 값, 없으면 열 때마다 계산한다.
 * 제출 여부는 보지 않는다: 자동 항목은 [최종 보고] 때 굳으므로 제출만 한 보고서는 살아 있는 값이다.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CurrentOperator } from "@/features/auth/queries";
import type { ReportRow, WeekRow } from "@/features/ops-weekly/schemas";
import { EMPTY, item, snap } from "./tab-fixtures";

const m = vi.hoisted(() => ({
  loadAutoSnapshot: vi.fn(),
  loadUnmatchedServices: vi.fn(),
  loadSettingsBundle: vi.fn(),
  report: null as unknown,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/ops-weekly/auto-queries", () => ({
  loadAutoSnapshot: m.loadAutoSnapshot,
  loadUnmatchedServices: m.loadUnmatchedServices,
}));

const WEEK: WeekRow = {
  id: "w1",
  week_start: "2026-11-16",
  label_year: 2026,
  label_month: 11,
  label_week: 3,
  duty_email: null,
  summary_this: "",
  summary_next: "",
  status: "open",
  reported_at: null,
  reported_by: null,
  reopened_at: null,
  reopened_by: null,
};
const WRITER = {
  email: "a@x",
  name: "운영자A",
  team: "운영1팀",
  role: "사원",
  status: "active",
};

vi.mock("@/features/ops-weekly/week-queries", () => ({
  getWeek: async () => WEEK,
  ensureWeek: async () => WEEK,
  listWriters: async () => [WRITER],
}));
vi.mock("@/features/ops-weekly/report-queries", () => ({
  ensureReport: async () => m.report,
  listReports: async () => [m.report],
  loadReportDetail: async () => EMPTY,
  listProjectEntriesForWeek: async () => [],
}));
vi.mock("@/features/ops-weekly/note-images", () => ({
  signProjectEntries: async <T>(entries: T) => entries,
}));
vi.mock("@/features/ops-weekly/settings-queries", () => ({
  loadSettingsBundle: m.loadSettingsBundle,
}));

import {
  freezeNoticeOf,
  loadOpsWeeklyPage,
  type OpsWeeklyView,
} from "../_load";

const ME: CurrentOperator = {
  email: "a@x",
  operator: null,
  displayName: "운영자A",
  role: "사원",
  team: null,
  permission: "member",
  allowedMenus: [],
};
const NOW = new Date("2026-11-19T01:00:00Z");

const reportOf = (over: Partial<ReportRow>): ReportRow => ({
  id: "r1",
  week_id: WEEK.id,
  operator_email: "a@x",
  status: "submitted",
  submitted_at: "2026-11-17T01:00:00Z",
  returned_at: null,
  returned_by: null,
  return_reason: null,
  snapshot: null,
  checked_tabs: [],
  ...over,
});

function kindOf(v: OpsWeeklyView) {
  if (v.kind !== "week") throw new Error("주가 없다");
  return v;
}

beforeEach(() => {
  m.loadAutoSnapshot.mockReset();
  m.loadUnmatchedServices.mockReset();
  m.loadSettingsBundle.mockReset().mockResolvedValue({ marker: "bundle" });
});

describe("loadOpsWeeklyPage — 자동 항목 읽는 규칙", () => {
  it("제출했지만 스냅샷이 비면 열 때마다 새로 계산한다 — 구분이 바뀌면 화면도 바뀐다", async () => {
    m.report = reportOf({ status: "submitted", snapshot: null });
    const testItem = item("closing:t1");
    m.loadAutoSnapshot
      .mockResolvedValueOnce(snap({ unknown: 1 }))
      .mockResolvedValueOnce({
        ...snap(),
        application: { ...snap().application, test: [testItem] },
      });
    const v1 = await loadOpsWeeklyPage(ME, {}, NOW);
    const v2 = await loadOpsWeeklyPage(ME, {}, NOW);
    expect(m.loadAutoSnapshot).toHaveBeenCalledTimes(2);
    expect(kindOf(v1).snapshot?.application.unknown).toHaveLength(1);
    expect(kindOf(v2).snapshot?.application.test).toHaveLength(1);
    expect(kindOf(v2).snapshot?.application.unknown).toHaveLength(0);
  });

  it("스냅샷이 있으면 원천이 바뀌어도 그 값이다", async () => {
    const SNAP = snap({ unknown: 2 });
    m.report = reportOf({ status: "submitted", snapshot: SNAP });
    m.loadAutoSnapshot.mockResolvedValue(snap());
    const v = await loadOpsWeeklyPage(ME, {}, NOW);
    expect(m.loadAutoSnapshot).not.toHaveBeenCalled();
    expect(kindOf(v).snapshot).toBe(SNAP);
  });
});

describe("loadOpsWeeklyPage — 안 붙은 서비스 목록", () => {
  const ADMIN: CurrentOperator = { ...ME, permission: "admin" };
  const LIST = { application: [], pims: [] };

  it("관리자의 설정 탭에서만, 그 주·작성 명단 기준으로 읽는다", async () => {
    m.report = reportOf({ status: "draft", snapshot: snap() });
    m.loadUnmatchedServices.mockResolvedValue(LIST);
    const v = await loadOpsWeeklyPage(ADMIN, { tab: "settings" }, NOW);
    expect(m.loadUnmatchedServices).toHaveBeenCalledTimes(1);
    const args = m.loadUnmatchedServices.mock.calls[0][0];
    expect(args.weekStart).toBe("2026-11-16");
    expect([...args.writerNames]).toEqual(["운영자A"]);
    expect(args.now).toBe(NOW);
    expect(kindOf(v).unmatched).toBe(LIST);
  });

  it("번들과 목록을 순서대로가 아니라 함께 요청한다", async () => {
    m.report = reportOf({ status: "draft", snapshot: snap() });
    let release: (v: typeof LIST) => void = () => {};
    m.loadUnmatchedServices.mockReturnValue(
      new Promise<typeof LIST>((r) => {
        release = r;
      }),
    );
    const pending = loadOpsWeeklyPage(ADMIN, { tab: "settings" }, NOW);
    await vi.waitFor(() =>
      expect(m.loadUnmatchedServices).toHaveBeenCalledTimes(1),
    );
    // 목록이 아직 안 끝났는데도 번들 읽기는 이미 시작됐다 — 직렬이면 여기서 막혀 있다.
    expect(m.loadSettingsBundle).toHaveBeenCalledTimes(1);
    release(LIST);
    await pending;
  });

  it("다른 탭이나 비관리자에게는 읽지도 내보내지도 않는다", async () => {
    m.report = reportOf({ status: "draft", snapshot: snap() });
    m.loadUnmatchedServices.mockResolvedValue(LIST);
    const a = await loadOpsWeeklyPage(ADMIN, { tab: "application" }, NOW);
    const b = await loadOpsWeeklyPage(ME, { tab: "settings" }, NOW);
    expect(m.loadUnmatchedServices).not.toHaveBeenCalled();
    expect(kindOf(a).unmatched).toBeNull();
    expect(kindOf(b).unmatched).toBeNull();
  });
});

describe("freezeNoticeOf", () => {
  const SNAP = snap();
  it.each([
    [
      "open·submitted·스냅샷 없음",
      { status: "open" },
      { status: "submitted", snapshot: null },
      true,
    ],
    ["작성 중", { status: "open" }, { status: "draft", snapshot: null }, false],
    [
      "굳음(정정 주)",
      { status: "open" },
      { status: "submitted", snapshot: SNAP },
      false,
    ],
    [
      "보고된 주",
      { status: "reported" },
      { status: "submitted", snapshot: null },
      false,
    ],
    ["보고서 없음", { status: "open" }, null, false],
  ] as const)("%s", (_, w, r, want) => {
    expect(freezeNoticeOf(w, r)).toBe(want);
  });

  it("loadOpsWeeklyPage 가 그대로 싣는다", async () => {
    m.report = reportOf({ status: "submitted", snapshot: null });
    m.loadAutoSnapshot.mockResolvedValue(snap());
    expect(kindOf(await loadOpsWeeklyPage(ME, {}, NOW)).freezeNotice).toBe(
      true,
    );
  });
});
