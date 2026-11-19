import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("server-only", () => ({}));

type Res = { data: unknown[] | null; error: { message: string } | null };
const responses = new Map<string, Res>();
const fromSpy: Mock = vi.fn();
const orderSpy: Mock = vi.fn();
const limitSpy: Mock = vi.fn();
const inSpy: Mock = vi.fn();
const selectSpy: Mock = vi.fn();

/** 체인 메서드는 자기 자신을 돌려주고, await 하면 그 테이블 응답이 나온다. */
function chain(table: string) {
  const self: Record<string, unknown> = {};
  const passthrough =
    (spy?: Mock) =>
    (...a: unknown[]) => {
      spy?.(...a);
      return self;
    };
  self.select = passthrough(selectSpy);
  self.order = passthrough(orderSpy);
  self.limit = passthrough(limitSpy);
  self.in = passthrough(inSpy);
  self.then = (resolve: (v: Res) => unknown) =>
    resolve(responses.get(table) ?? { data: [], error: null });
  return self;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      fromSpy(table);
      return chain(table);
    },
  }),
}));

import { OVERVIEW_WEEKS } from "../overview";
import { listReportStatusesForWeeks } from "../report-queries";
import { listRecentWeeks } from "../week-queries";

const weekRow = (id: string, week_start: string) => ({
  id,
  week_start,
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
});

beforeEach(() => {
  responses.clear();
  for (const s of [fromSpy, orderSpy, limitSpy, inSpy, selectSpy]) s.mockClear();
});

describe("listRecentWeeks", () => {
  it("최근 주부터 OVERVIEW_WEEKS 개 — week_start 내림차순 · limit, 받은 순서 그대로", async () => {
    responses.set("ops_weekly_weeks", {
      data: [weekRow("b", "2026-11-16"), weekRow("a", "2026-11-09")],
      error: null,
    });
    const rows = await listRecentWeeks(OVERVIEW_WEEKS);
    expect(fromSpy).toHaveBeenCalledWith("ops_weekly_weeks");
    expect(orderSpy).toHaveBeenCalledWith("week_start", { ascending: false });
    expect(limitSpy).toHaveBeenCalledWith(OVERVIEW_WEEKS);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });
  it("조회 실패는 던진다", async () => {
    responses.set("ops_weekly_weeks", {
      data: null,
      error: { message: "boom" },
    });
    await expect(listRecentWeeks(OVERVIEW_WEEKS)).rejects.toThrow("boom");
  });
});

describe("listReportStatusesForWeeks", () => {
  it("빈 배열이면 쿼리 없이 []", async () => {
    expect(await listReportStatusesForWeeks([])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });
  it("주 id 들을 in 한 번으로 읽고 이메일을 정규화한다", async () => {
    responses.set("ops_weekly_reports", {
      data: [{ week_id: "w1", operator_email: " A@X ", status: "submitted" }],
      error: null,
    });
    expect(await listReportStatusesForWeeks(["w1", "w2"])).toEqual([
      { weekId: "w1", operatorEmail: "a@x", status: "submitted" },
    ]);
    expect(inSpy).toHaveBeenCalledTimes(1);
    expect(inSpy).toHaveBeenCalledWith("week_id", ["w1", "w2"]);
    // 상태 칸만 읽는다 — 8주치 snapshot 같은 본문 칸은 안 읽는다
    expect(selectSpy).toHaveBeenCalledWith("week_id, operator_email, status");
  });
  it("조회 실패는 던진다", async () => {
    responses.set("ops_weekly_reports", {
      data: null,
      error: { message: "boom" },
    });
    await expect(listReportStatusesForWeeks(["w1"])).rejects.toThrow("boom");
  });
});
