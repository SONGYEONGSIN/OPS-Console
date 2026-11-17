/**
 * `freezeWeekSnapshots` 의 돌려주는 값(굳힌 수)만 본다.
 * 순서·실패·정정 규칙은 `workflow-actions.test.ts` 가 `finalizeWeek` 를 거쳐 본다.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { snap } from "@/app/dashboard/ops-weekly/__tests__/tab-fixtures";

const { snapshotSpy } = vi.hoisted(() => ({ snapshotSpy: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock(
  "@/lib/supabase/admin",
  async () => (await import("./actions-fixture")).adminModule,
);
vi.mock("../auto-queries", () => ({ loadAutoSnapshot: snapshotSpy }));

import { freezeWeekSnapshots } from "../freeze";
import { reportRowSchema, weekRowSchema } from "../schemas";
import { resetFixture, state } from "./actions-fixture";

const writer = (email: string, name: string) => ({
  email,
  name,
  team: "운영1팀",
  role: "사원",
  status: "active",
});

const weekOf = () => weekRowSchema.parse(state.db.rows("ops_weekly_weeks")[0]);
const reportsOf = () =>
  state.db.rows("ops_weekly_reports").map((r) => reportRowSchema.parse(r));

beforeEach(() => {
  resetFixture();
  snapshotSpy.mockResolvedValue(snap());
});

describe("freezeWeekSnapshots", () => {
  it("굳힌 보고서 수를 돌려준다 — 명단 밖 사람은 세지 않는다", async () => {
    expect(
      await freezeWeekSnapshots({
        week: weekOf(),
        writers: [writer("a@x", "운영자A")],
        reports: reportsOf(),
        now: new Date("2026-11-20T01:00:00Z"),
      }),
    ).toBe(1);
    expect(
      await freezeWeekSnapshots({
        week: weekOf(),
        writers: [writer("b@x", "운영자B")],
        reports: reportsOf(),
        now: new Date("2026-11-20T01:00:00Z"),
      }),
    ).toBe(0);
  });

  it("정정 주에서 이미 굳은 보고서만 있으면 0", async () => {
    state.db.rows("ops_weekly_weeks")[0].reopened_at = "2026-11-20T01:00:00Z";
    state.db.rows("ops_weekly_reports")[0].snapshot = snap({ unknown: 1 });
    expect(
      await freezeWeekSnapshots({
        week: weekOf(),
        writers: [writer("a@x", "운영자A")],
        reports: reportsOf(),
        now: new Date("2026-11-20T01:00:00Z"),
      }),
    ).toBe(0);
    expect(snapshotSpy).not.toHaveBeenCalled();
  });
});
