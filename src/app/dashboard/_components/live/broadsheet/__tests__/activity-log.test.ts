import { describe, it, expect } from "vitest";
import {
  buildActivityLog,
  levelToTone,
  timelinePercent,
  isInWindow,
  logDomainClass,
  timelineDotClass,
  selectTimelineEvents,
  groupTimelineEvents,
  timelineGroupLabel,
  kstSecondsOfDay,
  leaveCountdown,
  kstDateYmd,
  type ActivityLogEntry,
} from "../activity-log";
import type { WorklogRow } from "@/features/worklog/schemas";

function row(over: Partial<WorklogRow>): WorklogRow {
  return {
    id: "r1",
    created_at: "2026-06-13T00:42:17Z", // = 09:42:17 KST
    level: "INFO",
    domain: "nav",
    msg: "서강대 계약 체결",
    user_name: null,
    ...over,
  } as WorklogRow;
}

describe("levelToTone", () => {
  it("maps worklog levels to tones", () => {
    expect(levelToTone("ERROR")).toBe("err");
    expect(levelToTone("WARN")).toBe("warn");
    expect(levelToTone("DEBUG")).toBe("debug");
    expect(levelToTone("INFO")).toBe("info");
  });
});

describe("buildActivityLog", () => {
  it("derives KST hms + minutesOfDay + upper domain", () => {
    const [e] = buildActivityLog([row({})]);
    expect(e.hms).toBe("09:42:17");
    expect(e.minutesOfDay).toBe(9 * 60 + 42);
    expect(e.domain).toBe("NAV");
    expect(e.tone).toBe("info");
    expect(e.text).toBe("서강대 계약 체결");
  });

  it("prefixes user_name when present", () => {
    const [e] = buildActivityLog([row({ user_name: "김지나" })]);
    expect(e.text).toBe("김지나 · 서강대 계약 체결");
  });

  it("preserves input order (newest first)", () => {
    const out = buildActivityLog([
      row({ id: "a", created_at: "2026-06-13T01:00:00Z" }),
      row({ id: "b", created_at: "2026-06-13T00:00:00Z" }),
    ]);
    expect(out.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("timelinePercent (09:00–18:00 window)", () => {
  it("maps window bounds and midpoint, clamping outside", () => {
    expect(timelinePercent(9 * 60)).toBe(0);
    expect(timelinePercent(18 * 60)).toBe(100);
    expect(timelinePercent(13 * 60 + 30)).toBeCloseTo(50, 5);
    expect(timelinePercent(8 * 60)).toBe(0); // before window → clamp 0
    expect(timelinePercent(20 * 60)).toBe(100); // after window → clamp 100
  });
});

describe("isInWindow", () => {
  it("true within 09:00–18:00 inclusive", () => {
    expect(isInWindow(9 * 60)).toBe(true);
    expect(isInWindow(18 * 60)).toBe(true);
    expect(isInWindow(8 * 60 + 59)).toBe(false);
    expect(isInWindow(18 * 60 + 1)).toBe(false);
  });
});

describe("logDomainClass / timelineDotClass", () => {
  it("colors known log domains, muted fallback", () => {
    expect(logDomainClass("INCIDENTS")).toBe("text-vermilion");
    expect(logDomainClass("NAV")).toBe("text-gold");
    expect(logDomainClass("UNKNOWN")).toBe("text-muted");
  });
  it("maps tone to timeline dot color", () => {
    expect(timelineDotClass("err")).toBe("bg-vermilion");
    expect(timelineDotClass("warn")).toBe("bg-amber");
    expect(timelineDotClass("info")).toBe("bg-ink");
  });
});

describe("selectTimelineEvents", () => {
  const mk = (id: string, min: number): ActivityLogEntry => ({
    id,
    atIso: "x",
    hms: "00:00:00",
    minutesOfDay: min,
    domain: "NAV",
    text: "t",
    tone: "info",
  });
  it("keeps only in-window entries, sorted ascending", () => {
    const out = selectTimelineEvents(
      [
        mk("late", 19 * 60),
        mk("c", 14 * 60),
        mk("a", 9 * 60),
        mk("early", 7 * 60),
        mk("b", 11 * 60),
      ],
      6,
    );
    expect(out.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });
  it("thins clustered events by minimum gap (no overlap)", () => {
    // 12:23, 12:23, 12:30 군집 + 09:00, 16:00 → 군집은 첫 건만 대표 선택
    const out = selectTimelineEvents(
      [
        mk("m1", 12 * 60 + 23),
        mk("m2", 12 * 60 + 23),
        mk("m3", 12 * 60 + 30),
        mk("morning", 9 * 60),
        mk("late", 16 * 60),
      ],
      6,
    );
    // 09:00, 12:23(대표), 16:00 — 군집 m2/m3 제외 (min-gap 미달)
    expect(out.map((e) => e.id)).toEqual(["morning", "m1", "late"]);
  });
  it("caps to max after spacing", () => {
    const entries = [9, 11, 13, 15, 17].map((h, i) => mk(`e${i}`, h * 60));
    const out = selectTimelineEvents(entries, 3);
    expect(out).toHaveLength(3);
    expect(out.map((e) => e.id)).toEqual(["e0", "e1", "e2"]);
  });
});

describe("groupTimelineEvents", () => {
  const mk = (id: string, min: number): ActivityLogEntry => ({
    id,
    atIso: "x",
    hms: "00:00:00",
    minutesOfDay: min,
    domain: "NAV",
    text: "t",
    tone: "info",
  });

  it("clusters events within gap into one group (lead = earliest, members = all)", () => {
    // 12:23, 12:23, 12:30 군집 (모두 45분 이내) → 1 그룹
    const out = groupTimelineEvents(
      [mk("m3", 12 * 60 + 30), mk("m1", 12 * 60 + 23), mk("m2", 12 * 60 + 23)],
      6,
    );
    expect(out).toHaveLength(1);
    expect(out[0].lead.id).toBe("m1"); // 가장 이른 건
    expect(out[0].members.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    expect(out[0].minutesOfDay).toBe(12 * 60 + 23);
  });

  it("splits sufficiently spaced events into separate groups", () => {
    const out = groupTimelineEvents(
      [mk("a", 9 * 60), mk("b", 11 * 60), mk("c", 14 * 60)],
      6,
    );
    expect(out).toHaveLength(3);
    expect(out.map((g) => g.lead.id)).toEqual(["a", "b", "c"]);
    expect(out.every((g) => g.members.length === 1)).toBe(true);
  });

  it("filters out-of-window entries (09:00–18:00) before grouping", () => {
    const out = groupTimelineEvents(
      [mk("early", 7 * 60), mk("a", 9 * 60), mk("late", 19 * 60)],
      6,
    );
    expect(out.map((g) => g.lead.id)).toEqual(["a"]);
  });

  it("caps group count to maxGroups", () => {
    const entries = [9, 11, 13, 15, 17].map((h, i) => mk(`e${i}`, h * 60));
    const out = groupTimelineEvents(entries, 3);
    expect(out).toHaveLength(3);
    expect(out.map((g) => g.lead.id)).toEqual(["e0", "e1", "e2"]);
  });

  it("keeps clustering members even after group cap is reached", () => {
    // maxGroups=1: 첫 그룹만 만들되, 군집 멤버는 계속 흡수
    const out = groupTimelineEvents(
      [mk("m1", 12 * 60), mk("m2", 12 * 60 + 10), mk("far", 16 * 60)],
      1,
    );
    expect(out).toHaveLength(1);
    expect(out[0].members.map((m) => m.id)).toEqual(["m1", "m2"]);
  });
});

describe("kstSecondsOfDay / leaveCountdown", () => {
  it("computes KST seconds-of-day", () => {
    expect(kstSecondsOfDay(new Date("2026-06-13T06:30:00Z"))).toBe(
      15 * 3600 + 30 * 60,
    ); // 15:30 KST
  });
  it("counts down to 18:00, empty after", () => {
    expect(leaveCountdown(new Date("2026-06-13T06:30:00Z"))).toBe("2:30:00");
    expect(leaveCountdown(new Date("2026-06-13T10:00:00Z"))).toBe(""); // 19:00 KST → past
  });
  it("업무 시작(09:00) 전에는 최대 9:00:00로 cap", () => {
    expect(leaveCountdown(new Date("2026-06-12T20:00:00Z"))).toBe("9:00:00"); // 05:00 KST
    expect(leaveCountdown(new Date("2026-06-13T00:00:00Z"))).toBe("9:00:00"); // 09:00 KST 경계
  });
});

describe("kstDateYmd", () => {
  it("returns KST calendar date", () => {
    expect(kstDateYmd("2026-06-13T00:42:17Z")).toBe("2026-06-13"); // 09:42 KST same day
    expect(kstDateYmd("2026-06-13T20:00:00Z")).toBe("2026-06-14"); // 05:00 KST next day
  });
});

describe("ActivityLogEntry type", () => {
  it("is structurally usable", () => {
    const e: ActivityLogEntry = {
      id: "x",
      atIso: "2026-06-13T00:42:17Z",
      hms: "09:42:17",
      minutesOfDay: 582,
      domain: "NAV",
      text: "t",
      tone: "info",
    };
    expect(e.id).toBe("x");
  });
});

describe("timelineGroupLabel", () => {
  const ev = (over: Partial<ActivityLogEntry>): ActivityLogEntry => ({
    id: "e",
    atIso: "x",
    hms: "10:00:00",
    minutesOfDay: 600,
    domain: "자동화",
    text: "텍스트",
    tone: "info",
    ...over,
  });

  it("멤버가 모두 '자동화'이고 2건 이상이면 '자동화 실행 N건'", () => {
    const group = {
      lead: ev({ id: "a", text: "인사이트 영상 수집 9건" }),
      members: [
        ev({ id: "a", text: "인사이트 영상 수집 9건" }),
        ev({ id: "b", text: "운영자 미수채권 알림" }),
        ev({ id: "c", text: "입금 매칭 자동화" }),
      ],
      minutesOfDay: 600,
    };
    expect(timelineGroupLabel(group)).toBe("자동화 실행 3건");
  });

  it("자동화 단건이면 그 텍스트 그대로 (집계 건수는 이미 텍스트에 포함)", () => {
    const lead = ev({ id: "a", text: "인사이트 영상 수집 9건" });
    expect(
      timelineGroupLabel({ lead, members: [lead], minutesOfDay: 600 }),
    ).toBe("인사이트 영상 수집 9건");
  });

  it("혼합 도메인 군집은 기존대로 lead 텍스트 + (+N)", () => {
    const lead = ev({ id: "a", domain: "서비스", text: "이화여대 · 정시" });
    const group = {
      lead,
      members: [lead, ev({ id: "b", text: "운영자 미수채권 알림" })],
      minutesOfDay: 600,
    };
    expect(timelineGroupLabel(group)).toBe("이화여대 · 정시 (+1)");
  });

  it("자동화 아닌 동일 도메인 군집도 기존대로 lead + (+N)", () => {
    const lead = ev({ id: "a", domain: "할일", text: "할 일 하나" });
    const group = {
      lead,
      members: [lead, ev({ id: "b", domain: "할일", text: "할 일 둘" })],
      minutesOfDay: 600,
    };
    expect(timelineGroupLabel(group)).toBe("할 일 하나 (+1)");
  });
});
