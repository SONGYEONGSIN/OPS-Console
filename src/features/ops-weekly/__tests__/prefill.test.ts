import { describe, it, expect } from "vitest";
import { prefillEntry } from "../prefill";
import { weekStateOf, type WeekRow } from "../schemas";

const WEEK_1116: WeekRow = {
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

describe("prefillEntry", () => {
  it("단계 유지, 금주 ← 지난주 차주, 차주 빈칸", () => {
    expect(prefillEntry({ stage: "개발", next_week: "QA 착수" })).toEqual({
      stage: "개발",
      this_week: "QA 착수",
      next_week: "",
    });
  });

  it("지난주가 없으면 전부 비운다", () => {
    expect(prefillEntry(null)).toEqual({
      stage: null,
      this_week: "",
      next_week: "",
    });
  });
});

describe("weekStateOf", () => {
  it("reopened_at 까지 옮긴다", () => {
    expect(
      weekStateOf({
        ...WEEK_1116,
        status: "open",
        duty_email: "d@example.com",
        reopened_at: "2026-11-20T01:00:00Z",
      }),
    ).toEqual({
      status: "open",
      dutyEmail: "d@example.com",
      reopenedAt: "2026-11-20T01:00:00Z",
    });
  });
});
