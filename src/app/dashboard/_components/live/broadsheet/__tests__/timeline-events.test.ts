import { describe, it, expect } from "vitest";
import { buildTimelineEvents, type TimelineSource } from "../timeline-events";

const TODAY = "2026-06-14";

function src(over: Partial<TimelineSource>): TimelineSource {
  return {
    id: "s1",
    atIso: "2026-06-14T03:00:00Z", // 12:00 KST (in window, today)
    domain: "사고",
    text: "테스트 사고",
    tone: "err",
    ...over,
  };
}

describe("buildTimelineEvents", () => {
  it("keeps today + in-window events with KST hms/minutesOfDay", () => {
    const out = buildTimelineEvents([src({})], TODAY);
    expect(out).toHaveLength(1);
    expect(out[0].hms).toBe("12:00:00");
    expect(out[0].minutesOfDay).toBe(12 * 60);
    expect(out[0].domain).toBe("사고");
    expect(out[0].tone).toBe("err");
  });

  it("drops events from other days", () => {
    const out = buildTimelineEvents(
      [src({ id: "y", atIso: "2026-06-13T03:00:00Z" })],
      TODAY,
    );
    expect(out).toHaveLength(0);
  });

  it("drops today events outside 09–18 window", () => {
    // 2026-06-14T00:00:00Z = 09:00 KST (경계, 포함), 2026-06-13T23:00:00Z = 08:00 KST (제외)
    const inEdge = src({ id: "in", atIso: "2026-06-14T00:00:00Z" }); // 09:00 KST
    const before = src({ id: "before", atIso: "2026-06-13T23:00:00Z" }); // 08:00 KST → 전날이기도 함
    const after = src({ id: "after", atIso: "2026-06-14T10:00:00Z" }); // 19:00 KST
    const out = buildTimelineEvents([inEdge, before, after], TODAY);
    expect(out.map((e) => e.id)).toEqual(["in"]);
  });

  it("skips empty/falsy atIso", () => {
    const out = buildTimelineEvents([src({ id: "n", atIso: "" })], TODAY);
    expect(out).toHaveLength(0);
  });
});
