import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { fakeAdmin, type Row } from "./fake-admin";

vi.mock("server-only", () => ({}));

let db: ReturnType<typeof fakeAdmin>;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => db.client,
}));

const getCurrentOperator: Mock = vi.fn();
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => getCurrentOperator(),
}));

import { authorizeReportEdit } from "../guard";

const report = (over: Row = {}): Row => ({
  id: "r1",
  week_id: "w1",
  operator_email: "a@example.com",
  status: "draft",
  submitted_at: null,
  returned_at: null,
  returned_by: null,
  return_reason: null,
  snapshot: null,
  checked_tabs: [],
  ...over,
});
const week = (over: Row = {}): Row => ({
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
  ...over,
});

function me(email: string, permission = "member") {
  getCurrentOperator.mockResolvedValue({
    email,
    operator: null,
    displayName: email,
    role: "사원",
    team: null,
    permission,
    allowedMenus: [],
  });
}

describe("authorizeReportEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db = fakeAdmin({
      ops_weekly_reports: [report()],
      ops_weekly_weeks: [week()],
    });
  });

  it("본인이면 DB 에서 읽은 보고서·주·정규화한 actor 를 돌려준다", async () => {
    me(" A@Example.com ");
    const r = await authorizeReportEdit("r1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ctx.actor).toEqual({ email: "a@example.com", isAdmin: false });
    expect(r.ctx.report.id).toBe("r1");
    expect(r.ctx.week.week_start).toBe("2026-11-16");
  });

  it("주 행이 없으면 보고서를 찾을 수 없다", async () => {
    me("a@example.com");
    db = fakeAdmin({ ops_weekly_reports: [report({ week_id: "gone" })] });
    expect(await authorizeReportEdit("r1")).toEqual({
      ok: false,
      error: "보고서를 찾을 수 없습니다.",
    });
  });

  it("잠긴 주는 본인·당번·admin 모두 같은 문구로 거절한다", async () => {
    db = fakeAdmin({
      ops_weekly_reports: [report()],
      ops_weekly_weeks: [
        week({ status: "reported", duty_email: "d@example.com" }),
      ],
    });
    for (const [email, perm] of [
      ["a@example.com", "member"],
      ["d@example.com", "member"],
      ["z@example.com", "admin"],
    ]) {
      me(email, perm);
      expect(await authorizeReportEdit("r1")).toEqual({
        ok: false,
        error: "보고가 끝난 주입니다. 관리자에게 정정을 요청하세요.",
      });
    }
  });

  it("보고서 조회가 실패하면 던진다(빈 결과로 삼키지 않는다)", async () => {
    me("a@example.com");
    db.failTable("ops_weekly_reports", "down");
    await expect(authorizeReportEdit("r1")).rejects.toThrow(
      "[ops-weekly] ops_weekly_reports: down",
    );
  });
});
