import { describe, it, expect } from "vitest";
import { buildLiveTableItems, type LiveTableSources } from "../live-table-builder";

const now = new Date("2026-05-23T12:00:00+09:00");
const tEarlier = (mins: number) => new Date(now.getTime() - mins * 60 * 1000).toISOString();

describe("buildLiveTableItems", () => {
  it("incidents/todos/services/backup/schedule 통합 + 시간 desc 정렬", () => {
    const sources: LiveTableSources = {
      incidents: [{ id: "i1", title: "결제 오류", status: "미처리", createdAt: tEarlier(5), listRow: {} as never }],
      todos: [{ id: "t1", title: "PDF 검토", dueAt: "2026-05-22", createdAt: tEarlier(60), listRow: {} as never }],
      services: [{ id: "s1", title: "A대 원서접수", writeStartAt: "2026-06-24", createdAt: tEarlier(180), listRow: {} as never }],
      backup: [{ id: "b1", title: "휴가 백업", status: "대기", createdAt: tEarlier(30), listRow: {} as never }],
      schedule: [{ id: "e1", title: "정기회의", startAt: "2026-05-24T05:00:00Z", createdAt: tEarlier(10), listRow: {} as never }],
      handover: [],
    };
    const items = buildLiveTableItems(sources, now);
    expect(items.map((i) => i.id)).toEqual(["i1", "e1", "b1", "t1", "s1"]); // 시간 가까운 순
  });

  it("신규 도메인(공지/미수채권/계약) 매핑 + 계약은 시점 없어 최하단", () => {
    const sources: LiveTableSources = {
      incidents: [],
      todos: [],
      services: [],
      backup: [],
      schedule: [],
      handover: [],
      notice: [{ id: "n1", title: "정기 점검 공지", createdAt: tEarlier(5), listRow: {} as never }],
      receivables: [
        { id: "r1", title: "A대 전형료", status: "active", billedAt: "2026-05-01", listRow: {} as never },
        { id: "r2", title: "B대 전형료", status: "approved", billedAt: "2026-05-10", listRow: {} as never },
      ],
      contracts: [{ id: "c1", title: "C대 · 수시", status: "계약완료", listRow: {} as never }],
    };
    const items = buildLiveTableItems(sources, now);
    // 공지: ISO 시점이라 최상단, 계약: 시점 없어 최하단
    expect(items[0]?.id).toBe("n1");
    expect(items[items.length - 1]?.id).toBe("c1");

    const notice = items.find((x) => x.id === "n1");
    expect(notice?.badgeDomain).toBe("공지");
    expect(notice?.variant).toBe("post-notice");
    expect(notice?.statusText).toBe("공지");

    const recvUnpaid = items.find((x) => x.id === "r1");
    expect(recvUnpaid?.badgeDomain).toBe("미수채권");
    expect(recvUnpaid?.variant).toBe("receivables");
    expect(recvUnpaid?.statusText).toBe("미수");
    expect(items.find((x) => x.id === "r2")?.statusText).toBe("수금완료");

    const contract = items.find((x) => x.id === "c1");
    expect(contract?.badgeDomain).toBe("계약");
    expect(contract?.variant).toBe("contracts");
    expect(contract?.statusText).toBe("계약완료");
    expect(contract?.timeText).toBe("—");
  });

  it("트리아지 분류: 사고/지남=now, 오늘=today, D-7내=week, 그외=track", () => {
    const sources: LiveTableSources = {
      incidents: [{ id: "inc", title: "결제 오류", status: "미처리", createdAt: tEarlier(5), listRow: {} as never }],
      todos: [
        { id: "t-past", title: "지난 할일", dueAt: "2026-05-22", createdAt: tEarlier(60), listRow: {} as never },
        { id: "t-today", title: "오늘 할일", dueAt: "2026-05-23", createdAt: tEarlier(60), listRow: {} as never },
        { id: "t-week", title: "이번주 할일", dueAt: "2026-05-28", createdAt: tEarlier(60), listRow: {} as never },
        { id: "t-far", title: "먼 할일", dueAt: "2026-07-01", createdAt: tEarlier(60), listRow: {} as never },
        { id: "t-none", title: "대기 할일", dueAt: null, createdAt: tEarlier(60), listRow: {} as never },
      ],
      services: [
        { id: "sv-today", title: "오늘 오픈", writeStartAt: "2026-05-23", createdAt: tEarlier(180), listRow: {} as never },
        { id: "sv-week", title: "주중 오픈", writeStartAt: "2026-05-27", createdAt: tEarlier(180), listRow: {} as never },
      ],
      backup: [
        { id: "b-fail", title: "발송 실패 백업", status: "mail_failed", createdAt: tEarlier(30), listRow: {} as never },
        { id: "b-ok", title: "정상 백업", status: "pending", createdAt: tEarlier(30), listRow: {} as never },
      ],
      schedule: [{ id: "e-today", title: "오늘 회의", startAt: "2026-05-23T05:00:00Z", createdAt: tEarlier(10), listRow: {} as never }],
      handover: [{ id: "h-draft", title: "작성중 인계", status: "draft", createdAt: tEarlier(10), listRow: {} as never }],
      contracts: [{ id: "c1", title: "계약", status: "계약완료", listRow: {} as never }],
      notice: [{ id: "n1", title: "공지", createdAt: tEarlier(5), listRow: {} as never }],
      receivables: [{ id: "r1", title: "미수", status: "active", billedAt: "2026-05-01", listRow: {} as never }],
    };
    const items = buildLiveTableItems(sources, now);
    const tr = (id: string) => items.find((x) => x.id === id)?.triage;
    expect(tr("inc")).toBe("now");
    expect(tr("t-past")).toBe("now");
    expect(tr("b-fail")).toBe("now");
    expect(tr("t-today")).toBe("today");
    expect(tr("sv-today")).toBe("today");
    expect(tr("e-today")).toBe("today");
    expect(tr("t-week")).toBe("week");
    expect(tr("sv-week")).toBe("week");
    expect(tr("h-draft")).toBe("week");
    expect(tr("t-far")).toBe("track");
    expect(tr("t-none")).toBe("track");
    expect(tr("b-ok")).toBe("track");
    expect(tr("c1")).toBe("track");
    expect(tr("n1")).toBe("track");
    expect(tr("r1")).toBe("track");
  });

  it("각 도메인의 badgeDomain / variant / statusText 매핑", () => {
    const sources: LiveTableSources = {
      incidents: [{ id: "i", title: "x", status: "미처리", createdAt: tEarlier(1), listRow: {} as never }],
      todos: [{ id: "t", title: "x", dueAt: "2026-05-21", createdAt: tEarlier(2), listRow: {} as never }],
      services: [{ id: "s", title: "x", writeStartAt: "2026-06-24", createdAt: tEarlier(3), listRow: {} as never }],
      backup: [{ id: "b", title: "x", status: "대기", createdAt: tEarlier(4), listRow: {} as never }],
      schedule: [{ id: "e", title: "x", startAt: "2026-05-24T05:00:00Z", createdAt: tEarlier(5), listRow: {} as never }],
      handover: [],
    };
    const items = buildLiveTableItems(sources, now);
    expect(items.find((x) => x.id === "i")?.badgeDomain).toBe("사고");
    expect(items.find((x) => x.id === "i")?.variant).toBe("incidents");
    expect(items.find((x) => x.id === "i")?.statusText).toBe("미처리");

    expect(items.find((x) => x.id === "t")?.badgeDomain).toBe("할일");
    expect(items.find((x) => x.id === "t")?.variant).toBe("weekly-todo");
    expect(items.find((x) => x.id === "t")?.statusText).toBe("지남"); // dueAt < today

    expect(items.find((x) => x.id === "s")?.badgeDomain).toBe("서비스");
    expect(items.find((x) => x.id === "s")?.variant).toBe("services");
    expect(items.find((x) => x.id === "s")?.statusText).toBe("6.24 오픈");

    expect(items.find((x) => x.id === "b")?.badgeDomain).toBe("백업");
    expect(items.find((x) => x.id === "b")?.variant).toBe("backup");
    expect(items.find((x) => x.id === "b")?.statusText).toBe("대기");

    expect(items.find((x) => x.id === "e")?.badgeDomain).toBe("일정");
    expect(items.find((x) => x.id === "e")?.variant).toBe("schedule");
    expect(items.find((x) => x.id === "e")?.statusText).toMatch(/5\.24/);
  });

  it("todos 상태 4단계: 지남 / 오늘 / D-N / 대기", () => {
    const sources: LiveTableSources = {
      incidents: [], services: [], backup: [], schedule: [], handover: [],
      todos: [
        { id: "t1", title: "x", dueAt: "2026-05-22", createdAt: tEarlier(1), listRow: {} as never }, // < today → 지남
        { id: "t2", title: "x", dueAt: "2026-05-23", createdAt: tEarlier(2), listRow: {} as never }, // today
        { id: "t3", title: "x", dueAt: "2026-05-26", createdAt: tEarlier(3), listRow: {} as never }, // +3
        { id: "t4", title: "x", dueAt: null, createdAt: tEarlier(4), listRow: {} as never }, // 대기
      ],
    };
    const items = buildLiveTableItems(sources, now);
    expect(items.find((x) => x.id === "t1")?.statusText).toBe("지남");
    expect(items.find((x) => x.id === "t2")?.statusText).toBe("오늘");
    expect(items.find((x) => x.id === "t3")?.statusText).toBe("D-3");
    expect(items.find((x) => x.id === "t4")?.statusText).toBe("대기");
  });

  it("handover status 영문 → 한글 매핑 (draft/ready/published)", () => {
    const sources: LiveTableSources = {
      incidents: [], todos: [], services: [], backup: [], schedule: [],
      handover: [
        { id: "h1", title: "x", status: "draft", createdAt: tEarlier(1), listRow: {} as never },
        { id: "h2", title: "x", status: "ready", createdAt: tEarlier(2), listRow: {} as never },
        { id: "h3", title: "x", status: "published", createdAt: tEarlier(3), listRow: {} as never },
      ],
    };
    const items = buildLiveTableItems(sources, now);
    expect(items.find((x) => x.id === "h1")?.statusText).toBe("작성중");
    expect(items.find((x) => x.id === "h2")?.statusText).toBe("작성완료");
    expect(items.find((x) => x.id === "h3")?.statusText).toBe("인계완료");
  });

  it("timeText는 formatRelativeTime 결과 ('방금 전' 등)", () => {
    const sources: LiveTableSources = {
      incidents: [{ id: "x", title: "y", status: "미처리", createdAt: tEarlier(0), listRow: {} as never }],
      todos: [], services: [], backup: [], schedule: [], handover: [],
    };
    const items = buildLiveTableItems(sources, now);
    expect(items[0].timeText).toBe("방금 전");
  });

  it("handover 행 매핑: badgeDomain=인수인계, variant=handover, statusText 한글", () => {
    const sources: LiveTableSources = {
      incidents: [], todos: [], services: [], backup: [], schedule: [],
      handover: [
        { id: "h1", title: "서울대 · 원서접수", status: "published", createdAt: tEarlier(2), listRow: {} as never },
      ],
    };
    const items = buildLiveTableItems(sources, now);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("h1");
    expect(items[0].badgeDomain).toBe("인수인계");
    expect(items[0].variant).toBe("handover");
    expect(items[0].statusText).toBe("인계완료");
    expect(items[0].title).toBe("서울대 · 원서접수");
  });
});
