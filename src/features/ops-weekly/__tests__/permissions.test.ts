import { describe, expect, it } from "vitest";
import {
  type Actor,
  canEditDutySummary,
  canEditReport,
  canManageSettings,
  canReopenWeek,
  canReturnReport,
  canSubmitReport,
  checkFinalize,
  isDuty,
  statusAccess,
  type WeekState,
} from "../permissions";

const open: WeekState = { status: "open", dutyEmail: "d@x", reopenedAt: null };
const reopened: WeekState = {
  status: "open",
  dutyEmail: "d@x",
  reopenedAt: "2026-11-20T01:00:00Z",
};
const locked: WeekState = {
  status: "reported",
  dutyEmail: "d@x",
  reopenedAt: null,
};
const user = (email: string, isAdmin = false) => ({ email, isAdmin });

describe("canEditReport", () => {
  it("본인·당번, 잠긴 주는 아무도", () => {
    expect(canEditReport(user("a@x"), open, "a@x")).toBe(true);
    expect(canEditReport(user("d@x"), open, "a@x")).toBe(true);
    expect(canEditReport(user("z@x"), open, "a@x")).toBe(false);
    expect(canEditReport(user("z@x", true), locked, "a@x")).toBe(false);
  });
  it("admin 은 정정으로 다시 연 주에만 남의 보고서를 고친다", () => {
    expect(canEditReport(user("z@x", true), open, "a@x")).toBe(false);
    expect(canEditReport(user("z@x", true), reopened, "a@x")).toBe(true);
    expect(canEditReport(user("z@x"), reopened, "a@x")).toBe(false);
  });
});

describe("canSubmitReport", () => {
  it("제출은 본인만 — 당번도 대리 제출 못 한다", () => {
    expect(canSubmitReport(user("d@x"), open, "a@x", true, "draft")).toBe(
      false,
    );
    expect(canSubmitReport(user("a@x"), open, "a@x", false, "draft")).toBe(
      false,
    );
  });
  it("draft·returned 만 — 이미 낸 것도 잠긴 주도 못 낸다", () => {
    const a = user("a@x");
    expect(canSubmitReport(a, open, "a@x", true, "draft")).toBe(true);
    expect(canSubmitReport(a, open, "a@x", true, "returned")).toBe(true);
    expect(canSubmitReport(a, open, "a@x", true, "submitted")).toBe(false);
    expect(canSubmitReport(a, locked, "a@x", true, "draft")).toBe(false);
  });
});

describe("다시 작성·주요 요약", () => {
  it("당번·admin, 열린 주, 다시 작성은 submitted 만", () => {
    expect(canReturnReport(user("d@x"), open, "submitted")).toBe(true);
    expect(canReturnReport(user("d@x"), open, "draft")).toBe(false);
    expect(canReturnReport(user("a@x"), open, "submitted")).toBe(false);
    expect(canReturnReport(user("z@x", true), locked, "submitted")).toBe(false);
    expect(canEditDutySummary(user("z@x", true), open)).toBe(true);
    expect(canEditDutySummary(user("d@x"), locked)).toBe(false);
    expect(canEditDutySummary(user("a@x"), open)).toBe(false);
  });
});

describe("checkFinalize", () => {
  it("빈 명단은 전원 제출이 아니다", () => {
    expect(checkFinalize(user("d@x"), open, [], new Set())).toEqual({
      ok: false,
      reason: "empty-roster",
      pending: [],
    });
  });
  it("미제출자 목록을 roster 순서로 돌려준다", () => {
    expect(
      checkFinalize(user("d@x"), open, ["b@x", "a@x", "c@x"], new Set(["a@x"])),
    ).toEqual({ ok: false, reason: "pending", pending: ["b@x", "c@x"] });
  });
  it("당번/admin 이 아니면 forbidden, 잠긴 주는 locked, 다 내면 ok", () => {
    const all = new Set(["a@x"]);
    expect(checkFinalize(user("a@x"), open, ["a@x"], all)).toMatchObject({
      reason: "forbidden",
    });
    expect(checkFinalize(user("d@x"), locked, ["a@x"], all)).toMatchObject({
      reason: "locked",
    });
    expect(checkFinalize(user("d@x"), open, ["a@x"], all)).toEqual({
      ok: true,
    });
    expect(checkFinalize(user("z@x", true), open, ["a@x"], all)).toEqual({
      ok: true,
    });
  });
  it("판정 순서 — forbidden 이 locked 보다 먼저", () => {
    expect(checkFinalize(user("a@x"), locked, [], new Set())).toMatchObject({
      reason: "forbidden",
    });
  });
});

describe("정정·설정", () => {
  it("정정은 admin · 보고된 주만", () => {
    expect(canReopenWeek(user("d@x"), locked)).toBe(false);
    expect(canReopenWeek(user("z@x", true), open)).toBe(false);
    expect(canReopenWeek(user("z@x", true), locked)).toBe(true);
  });
  it("설정은 admin 만", () => {
    expect(canManageSettings(user("z@x", true))).toBe(true);
    expect(canManageSettings(user("d@x"))).toBe(false);
  });
});

const wk = (o: Partial<WeekState> = {}): WeekState => ({
  status: "open",
  dutyEmail: "d@x",
  reopenedAt: null,
  ...o,
});
const who = (email: string, isAdmin = false): Actor => ({ email, isAdmin });

describe("statusAccess — 제출 현황·남의 보고서를 여는 사람", () => {
  it.each([
    ["관리자 · 열린 주", who("z@x", true), wk(), false, "manage"],
    ["관리자 · 보고된 주", who("z@x", true), wk({ status: "reported" }), false, "manage"],
    ["그 주 당번", who("d@x"), wk(), false, "manage"],
    ["다른 사람이 당번인 주", who("d@x"), wk({ dutyEmail: "e@x" }), false, null],
    ["당번 미지정 주", who("d@x"), wk({ dutyEmail: null }), false, null],
    ["받는 사람 · 보고된 주", who("r@x"), wk({ status: "reported" }), true, "read"],
    ["받는 사람 · 열린 주", who("r@x"), wk(), true, null],
    [
      "받는 사람 · 정정으로 연 주(open)",
      who("r@x"),
      wk({ reopenedAt: "2026-11-20T08:00:00Z" }),
      true,
      null,
    ],
    ["역할 없음 · 보고된 주", who("n@x"), wk({ status: "reported" }), false, null],
  ] as const)("%s", (_, actor, week, rec, want) => {
    expect(statusAccess(actor, week, rec)).toBe(want);
  });
  it("isDuty 를 내보낸다 — 당번 미지정이면 false", () => {
    expect(isDuty(who("d@x"), wk())).toBe(true);
    expect(isDuty(who("d@x"), wk({ dutyEmail: null }))).toBe(false);
  });
});
