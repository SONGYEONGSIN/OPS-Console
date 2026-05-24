import { describe, it, expect } from "vitest";
import { activityScore, type ActivityCounts } from "../activity-aggregator";

describe("activityScore — 5 도메인 카운트 → 점수 환산", () => {
  it("모두 0 → score 0", () => {
    const counts: ActivityCounts = {
      worklog: 0,
      services: 0,
      todosDone: 0,
      aiWork: 0,
      incidentsResolved: 0,
    };
    expect(activityScore(counts).total).toBe(0);
  });

  it("단순 합산 — 5 도메인 균등 가중치 (1차 PR placeholder)", () => {
    const counts: ActivityCounts = {
      worklog: 10,
      services: 5,
      todosDone: 20,
      aiWork: 2,
      incidentsResolved: 3,
    };
    const r = activityScore(counts);
    // 1차는 단순 합 (가중치 환산식은 follow-up에서 사용자 검토 후 조정)
    expect(r.total).toBe(40);
  });

  it("breakdown — 5 도메인 모두 노출", () => {
    const counts: ActivityCounts = {
      worklog: 1,
      services: 2,
      todosDone: 3,
      aiWork: 4,
      incidentsResolved: 5,
    };
    const r = activityScore(counts);
    expect(r.breakdown).toEqual({
      worklog: 1,
      services: 2,
      todosDone: 3,
      aiWork: 4,
      incidentsResolved: 5,
    });
  });

  it("음수 카운트는 0으로 clamp", () => {
    const r = activityScore({
      worklog: -5,
      services: 3,
      todosDone: 0,
      aiWork: 0,
      incidentsResolved: 0,
    });
    expect(r.total).toBe(3);
  });
});
