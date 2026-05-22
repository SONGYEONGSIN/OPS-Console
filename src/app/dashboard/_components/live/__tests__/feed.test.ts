import { describe, it, expect } from "vitest";
import { buildFeedItems, sortFeedItems, formatFeedDate, type FeedItem } from "../feed";

const now = new Date("2026-05-23T03:00:00Z"); // KST 12:00, today=2026-05-23

describe("buildFeedItems", () => {
  it("incidents/todos/services/schedule/backup 소스를 FeedItem[]로 매핑", () => {
    const items = buildFeedItems({
      incidents: [
        { id: "i1", title: "결제 오류", occurred_date: "2026-05-22", status: "미처리", listRow: { id: "i1" } as never },
        { id: "i2", title: "로그 누락", occurred_date: "2026-05-20", status: "처리완료", listRow: { id: "i2" } as never },
      ],
      todos: [
        { id: "t1", title: "PDF 검토", due_at: "2026-05-22", listRow: { id: "t1" } as never },
        { id: "t2", title: "리뷰", due_at: null, listRow: { id: "t2" } as never },
      ],
      services: [
        { id: "s1", title: "A대 원서접수", write_start_at: "2026-05-25", listRow: { id: "s1" } as never },
      ],
      schedule: [
        { id: "e1", title: "정기회의", start_at: "2026-05-24T05:00:00Z", listRow: { id: "e1" } as never },
      ],
      backup: [
        { id: "b1", title: "휴가 백업", leave_start_date: "2026-05-26", listRow: { id: "b1" } as never },
      ],
    }, now);
    expect(items.length).toBe(7);
    expect(items.find((x) => x.id === "i1")?.domain).toBe("incidents");
    expect(items.find((x) => x.id === "i1")?.domainLabel).toBe("사고");
    expect(items.find((x) => x.id === "t1")?.domain).toBe("todos");
    expect(items.find((x) => x.id === "t1")?.domainLabel).toBe("내 할일");
  });
});

describe("sortFeedItems", () => {
  it("urgent → scheduled → undated, 각 그룹 내 일자 asc", () => {
    const items: FeedItem[] = [
      { id: "a", domain: "services", domainLabel: "서비스", variant: "services" as never, date: "2026-05-25", dateDisplay: "5.25", title: "A", tier: "scheduled", listRow: {} as never },
      { id: "b", domain: "incidents", domainLabel: "사고", variant: "incidents" as never, date: "2026-05-22", dateDisplay: "미해결", title: "B", tier: "urgent", listRow: {} as never },
      { id: "c", domain: "todos", domainLabel: "내 할일", variant: "weekly-todo" as never, date: null, dateDisplay: "—", title: "C", tier: "undated", listRow: {} as never },
      { id: "d", domain: "todos", domainLabel: "내 할일", variant: "weekly-todo" as never, date: "2026-05-20", dateDisplay: "지남", title: "D", tier: "urgent", listRow: {} as never },
      { id: "e", domain: "schedule", domainLabel: "일정", variant: "schedule" as never, date: "2026-05-24", dateDisplay: "5.24", title: "E", tier: "scheduled", listRow: {} as never },
    ];
    expect(sortFeedItems(items).map((x) => x.id)).toEqual(["d", "b", "e", "a", "c"]);
  });
});

describe("formatFeedDate", () => {
  it("urgent + incidents → 미해결", () => {
    expect(formatFeedDate({ tier: "urgent", domain: "incidents", date: "2026-05-22" }, now)).toBe("미해결");
  });
  it("urgent + todos → 지남", () => {
    expect(formatFeedDate({ tier: "urgent", domain: "todos", date: "2026-05-22" }, now)).toBe("지남");
  });
  it("scheduled + 오늘 → 오늘", () => {
    expect(formatFeedDate({ tier: "scheduled", domain: "services", date: "2026-05-23" }, now)).toBe("오늘");
  });
  it("scheduled + 미래 → M.D", () => {
    expect(formatFeedDate({ tier: "scheduled", domain: "services", date: "2026-05-25" }, now)).toBe("5.25");
  });
  it("undated → —", () => {
    expect(formatFeedDate({ tier: "undated", domain: "todos", date: null }, now)).toBe("—");
  });
});

describe("buildFeedItems + tier 판정", () => {
  it("사고 status='처리완료'는 scheduled, 그 외 urgent", () => {
    const items = buildFeedItems({
      incidents: [
        { id: "i1", title: "X", occurred_date: "2026-05-22", status: "미처리", listRow: {} as never },
        { id: "i2", title: "Y", occurred_date: "2026-05-22", status: "처리중", listRow: {} as never },
        { id: "i3", title: "Z", occurred_date: "2026-05-22", status: "처리완료", listRow: {} as never },
      ],
      todos: [], services: [], schedule: [], backup: [],
    }, now);
    expect(items.find((x) => x.id === "i1")?.tier).toBe("urgent");
    expect(items.find((x) => x.id === "i2")?.tier).toBe("urgent");
    expect(items.find((x) => x.id === "i3")?.tier).toBe("scheduled");
  });
  it("todos: due_at < today → urgent, >= today → scheduled, null → undated", () => {
    const items = buildFeedItems({
      incidents: [], services: [], schedule: [], backup: [],
      todos: [
        { id: "t1", title: "A", due_at: "2026-05-22", listRow: {} as never },
        { id: "t2", title: "B", due_at: "2026-05-23", listRow: {} as never },
        { id: "t3", title: "C", due_at: "2026-05-25", listRow: {} as never },
        { id: "t4", title: "D", due_at: null, listRow: {} as never },
      ],
    }, now);
    expect(items.find((x) => x.id === "t1")?.tier).toBe("urgent");
    expect(items.find((x) => x.id === "t2")?.tier).toBe("scheduled");
    expect(items.find((x) => x.id === "t3")?.tier).toBe("scheduled");
    expect(items.find((x) => x.id === "t4")?.tier).toBe("undated");
  });
});
