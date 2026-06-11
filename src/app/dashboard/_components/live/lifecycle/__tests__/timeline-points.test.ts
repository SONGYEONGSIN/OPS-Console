import { describe, it, expect } from "vitest";
import { computeTimeline } from "../timeline-points";
import type { TimelineEvent } from "../timeline-points";

// KST(Asia/Seoul) 기준. ISO에 +09:00 오프셋을 명시해 환경 TZ와 무관하게 검증.
const ev = (id: string, at: string): TimelineEvent => ({
  id,
  label: id,
  kind: "due",
  at,
});

describe("computeTimeline — leftPct 좌표", () => {
  it("09:00 → 0%", () => {
    const { points } = computeTimeline(
      [ev("a", "09:00")],
      "2026-06-11T12:00:00+09:00",
    );
    expect(points[0].leftPct).toBe(0);
  });

  it("18:00 → 100%", () => {
    const { points } = computeTimeline(
      [ev("a", "18:00")],
      "2026-06-11T12:00:00+09:00",
    );
    expect(points[0].leftPct).toBe(100);
  });

  it("13:30 → 50% (09~18 축의 중앙)", () => {
    const { points } = computeTimeline(
      [ev("a", "13:30")],
      "2026-06-11T12:00:00+09:00",
    );
    expect(points[0].leftPct).toBe(50);
  });

  it("ISO 시각도 HH:mm와 동일하게 매핑 (KST)", () => {
    const { points } = computeTimeline(
      [ev("a", "2026-06-11T13:30:00+09:00")],
      "2026-06-11T12:00:00+09:00",
    );
    expect(points[0].leftPct).toBe(50);
  });

  it("축 범위 밖(이른 시각)은 0%로 clamp", () => {
    const { points } = computeTimeline(
      [ev("a", "06:00")],
      "2026-06-11T12:00:00+09:00",
    );
    expect(points[0].leftPct).toBe(0);
  });

  it("축 범위 밖(늦은 시각)은 100%로 clamp", () => {
    const { points } = computeTimeline(
      [ev("a", "23:00")],
      "2026-06-11T12:00:00+09:00",
    );
    expect(points[0].leftPct).toBe(100);
  });
});

describe("computeTimeline — nowPct", () => {
  it("now 13:30 → nowPct 50%", () => {
    const { nowPct } = computeTimeline([], "2026-06-11T13:30:00+09:00");
    expect(nowPct).toBe(50);
  });

  it("now가 축 시작 이전이면 0%로 clamp", () => {
    const { nowPct } = computeTimeline([], "2026-06-11T07:00:00+09:00");
    expect(nowPct).toBe(0);
  });

  it("now가 축 끝 이후면 100%로 clamp", () => {
    const { nowPct } = computeTimeline([], "2026-06-11T20:00:00+09:00");
    expect(nowPct).toBe(100);
  });
});

describe("computeTimeline — 옵션/필드 보존", () => {
  it("dayStartHour/dayEndHour 커스텀 축 (08~20에서 14:00 → 50%)", () => {
    const { points } = computeTimeline(
      [ev("a", "14:00")],
      "2026-06-11T12:00:00+09:00",
      {
        dayStartHour: 8,
        dayEndHour: 20,
      },
    );
    expect(points[0].leftPct).toBe(50);
  });

  it("id/label/kind를 포인트에 그대로 전달", () => {
    const events: TimelineEvent[] = [
      { id: "x1", label: "독려발송", kind: "mail", at: "10:30" },
      { id: "x2", label: "당직 교대", kind: "sch", at: "12:00" },
    ];
    const { points } = computeTimeline(events, "2026-06-11T12:00:00+09:00");
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({
      id: "x1",
      label: "독려발송",
      kind: "mail",
    });
    expect(points[1]).toMatchObject({
      id: "x2",
      label: "당직 교대",
      kind: "sch",
    });
  });

  it("빈 이벤트 배열이면 points는 빈 배열", () => {
    const { points } = computeTimeline([], "2026-06-11T12:00:00+09:00");
    expect(points).toEqual([]);
  });
});
