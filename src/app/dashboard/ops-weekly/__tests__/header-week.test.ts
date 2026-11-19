import { describe, it, expect } from "vitest";
import type { WeekRow } from "@/features/ops-weekly/schemas";
import { headerWeekOf } from "../_header-week";

const WEEK: WeekRow = {
  id: "w1",
  week_start: "2026-11-16",
  label_year: 2026,
  label_month: 11,
  label_week: 3,
  duty_email: "d@x",
  summary_this: "당번 총평 금주",
  summary_next: "당번 총평 차주",
  status: "reported",
  reported_at: "2026-11-20T08:00:00Z",
  reported_by: "d@x",
  reopened_at: null,
  reopened_by: null,
};

describe("headerWeekOf", () => {
  it("머리띠가 읽는 세 칸만 담은 새 객체 — 당번 총평 키가 없다", () => {
    const h = headerWeekOf(WEEK);
    expect(Object.keys(h).sort()).toEqual([
      "reported_at",
      "status",
      "week_start",
    ]);
    expect(h).toEqual({
      week_start: "2026-11-16",
      status: "reported",
      reported_at: "2026-11-20T08:00:00Z",
    });
    expect(h).not.toHaveProperty("summary_this");
    expect(h).not.toHaveProperty("summary_next");
    expect(h).not.toBe(WEEK);
  });
});
