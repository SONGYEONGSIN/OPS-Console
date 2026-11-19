import { describe, expect, it } from "vitest";
import type { ReportStatus } from "../constants";
import { buildWeekOverview, weekPhaseOf } from "../overview";
import type { WriterCandidate } from "../roster";
import type { WeekRow } from "../schemas";
import { weekRefFromStart } from "../week";

const week = (o: Partial<WeekRow>): WeekRow => ({
  id: "w1",
  week_start: "2026-11-16",
  label_year: 2026,
  label_month: 11,
  label_week: 3,
  duty_email: "D@X",
  summary_this: "",
  summary_next: "",
  status: "open",
  reported_at: null,
  reported_by: null,
  reopened_at: null,
  reopened_by: null,
  ...o,
});

const rep = (
  weekId: string,
  operatorEmail: string,
  status: ReportStatus = "submitted",
) => ({ weekId, operatorEmail, status });

const writer = (email: string, name: string): WriterCandidate => ({
  email,
  name,
  team: "운영1팀",
  role: "사원",
  status: "active",
});
const writers = [writer("a@x", "홍길동"), writer("d@x", "당번이")];

describe("buildWeekOverview", () => {
  it("열린 주: 지금 명단 ∩ 제출 / 지금 명단 — 명단 밖 제출은 세지 않는다", () => {
    const [r] = buildWeekOverview({
      weeks: [week({})],
      reports: [
        rep("w1", "a@x"),
        rep("w1", "gone@x"),
        rep("w1", "d@x", "draft"),
      ],
      writers,
    });
    expect([r.submitted, r.total]).toEqual([1, 2]);
  });

  it("보고 완료 주: 그 주 제출 행 / 그 주 행 — 지금 명단과 무관", () => {
    const [r] = buildWeekOverview({
      weeks: [week({ status: "reported", reported_at: "2026-11-20T08:05:00Z" })],
      reports: [rep("w1", "a@x"), rep("w1", "gone@x"), rep("w1", "old@x")],
      writers,
    });
    expect([r.submitted, r.total]).toEqual([3, 3]);
    expect(r.reportedAt).toBe("2026-11-20T08:05:00Z");
  });

  it("다른 주의 보고서 행은 세지 않는다", () => {
    const [r] = buildWeekOverview({
      weeks: [week({})],
      reports: [rep("w1", "a@x"), rep("w2", "d@x")],
      writers,
    });
    expect([r.submitted, r.total]).toEqual([1, 2]);
  });

  it("당번 이름 — 대소문자 무시 명단 이름 → 이메일 → null", () => {
    const rows = buildWeekOverview({
      weeks: [
        week({}),
        week({ id: "w2", duty_email: "x@x" }),
        week({ id: "w3", duty_email: null }),
      ],
      reports: [],
      writers,
    });
    expect(rows.map((r) => r.dutyName)).toEqual(["당번이", "x@x", null]);
  });

  it("받은 순서(최근 주 먼저) 그대로, 라벨은 weekRefFromStart", () => {
    const rows = buildWeekOverview({
      weeks: [
        week({ id: "b", week_start: "2026-11-16" }),
        week({ id: "a", week_start: "2026-11-09" }),
      ],
      reports: [],
      writers,
    });
    expect(rows.map((r) => r.weekId)).toEqual(["b", "a"]);
    const ref = weekRefFromStart("2026-11-16")!;
    expect(rows[0].label).toBe(ref.label);
    expect(rows[0].rangeLabel).toBe(ref.rangeLabel);
  });

  it("월요일이 아닌 week_start 는 week_start 와 빈 범위로 쓴다", () => {
    const [r] = buildWeekOverview({
      weeks: [week({ week_start: "2026-11-17" })],
      reports: [],
      writers,
    });
    expect([r.label, r.rangeLabel]).toEqual(["2026-11-17", ""]);
  });

  it("state 는 정규화한 주 상태다", () => {
    const [r] = buildWeekOverview({
      weeks: [week({ reopened_at: "2026-11-21T01:00:00Z" })],
      reports: [],
      writers,
    });
    expect(r.state).toEqual({
      status: "open",
      dutyEmail: "d@x",
      reopenedAt: "2026-11-21T01:00:00Z",
    });
  });
});

describe("weekPhaseOf", () => {
  it("열림 / 정정으로 열림 / 보고 완료", () => {
    expect(
      weekPhaseOf({ status: "open", dutyEmail: null, reopenedAt: null }),
    ).toBe("open");
    expect(
      weekPhaseOf({
        status: "open",
        dutyEmail: null,
        reopenedAt: "2026-11-21T01:00:00Z",
      }),
    ).toBe("reopened");
    expect(
      weekPhaseOf({ status: "reported", dutyEmail: null, reopenedAt: null }),
    ).toBe("reported");
  });
});
