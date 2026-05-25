import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/incidents/queries", () => ({
  listIncidents: vi.fn(async () => ({ rows: [], total: 0 })),
}));
vi.mock("@/features/handover/progress-queries", () => ({
  listHandoverProgress: vi.fn(async () => ({ rows: [], total: 0 })),
}));
vi.mock("@/features/services/queries", () => ({
  listServices: vi.fn(async () => ({ rows: [], total: 0 })),
}));
vi.mock("@/features/todos/queries", () => ({
  listMyTodos: vi.fn(async () => []),
}));
vi.mock("@/features/backup-requests/queries", () => ({
  listBackupRequests: vi.fn(async () => ({ rows: [], total: 0 })),
}));
vi.mock("@/features/contracts/queries", () => ({
  listContracts: vi.fn(async () => ({ rows: [], total: 0 })),
}));
vi.mock("@/features/receivables/queries", () => ({
  fetchReceivablesSheet: vi.fn(async () => null),
}));
vi.mock("@/app/dashboard/receivables/_row-mapper", () => ({
  receivablesToListRow: vi.fn(),
  isReceivablesDataRow: vi.fn(() => true),
}));
vi.mock("@/features/posts/queries", () => ({
  listPosts: vi.fn(),
}));

import { getOpsAlerts } from "../queries";
import { listPosts } from "@/features/posts/queries";
import { fetchReceivablesSheet } from "@/features/receivables/queries";
import { receivablesToListRow } from "@/app/dashboard/receivables/_row-mapper";

const me = { email: "any@x.com", displayName: "anyone" };

function noticeRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: `nt-${Math.random().toString(36).slice(2, 8)}`,
    domain: "notice",
    slug: "NT-001",
    title: "시스템 점검 안내",
    body: "본문",
    author_email: "admin@x.com",
    author_id: null,
    owner_label: null,
    status: "active",
    created_at: "2026-05-20T10:00:00+09:00",
    updated_at: "2026-05-20T10:00:00+09:00",
    ...over,
  };
}

beforeEach(() => {
  vi.mocked(listPosts).mockReset();
  vi.mocked(listPosts).mockResolvedValue([]);
  vi.mocked(fetchReceivablesSheet).mockReset();
  vi.mocked(receivablesToListRow).mockReset();
});

// ListRow 필드 매핑 (receivables): name=학교명, body=내역, author=금액, owner=운영자, meta=청구일
function rcvRow(over: Partial<{
  id: string;
  name: string;
  author: string;
  owner: string;
  status: "active" | "approved";
  meta: string;
}> = {}) {
  return {
    id: "r-0",
    name: "부산대학교",
    body: "",
    author: "1,500,000",
    owner: "송영신",
    status: "active",
    meta: "2026-04-30",
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("getOpsAlerts — 공지사항", () => {
  it("active 공지를 '공지' 카테고리 알림으로 반환 (본인 필터 없음)", async () => {
    vi.mocked(listPosts).mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      noticeRow({ id: "n1", title: "시스템 점검", status: "active" }) as any,
    ]);
    const alerts = await getOpsAlerts(me);
    const notices = alerts.filter((a) => a.category === "공지");
    expect(notices).toHaveLength(1);
    expect(notices[0].label).toContain("시스템 점검");
    expect(notices[0].href).toBe("/dashboard/notices");
  });

  it("urgent 공지는 tone=urgent, 그 외는 review", async () => {
    vi.mocked(listPosts).mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      noticeRow({ id: "n1", title: "긴급", status: "urgent" }) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      noticeRow({ id: "n2", title: "활성", status: "active" }) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      noticeRow({ id: "n3", title: "예약", status: "review" }) as any,
    ]);
    const alerts = await getOpsAlerts(me);
    const byLabel = Object.fromEntries(
      alerts.filter((a) => a.category === "공지").map((a) => [a.label.split(" ")[0], a.tone]),
    );
    expect(byLabel["긴급"]).toBe("urgent");
    expect(byLabel["활성"]).toBe("review");
    expect(byLabel["예약"]).toBe("review");
  });

  it("approved(종료) 공지는 제외", async () => {
    vi.mocked(listPosts).mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      noticeRow({ id: "n1", title: "현재", status: "active" }) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      noticeRow({ id: "n2", title: "종료된공지", status: "approved" }) as any,
    ]);
    const alerts = await getOpsAlerts(me);
    const labels = alerts.filter((a) => a.category === "공지").map((a) => a.label);
    expect(labels.some((l) => l.includes("현재"))).toBe(true);
    expect(labels.some((l) => l.includes("종료된공지"))).toBe(false);
  });

  it("MAX 5건으로 자름 (도메인당 한도 일관)", async () => {
    const seven = Array.from({ length: 7 }, (_, i) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      noticeRow({ id: `n${i}`, title: `공지${i}`, status: "active" }) as any,
    );
    vi.mocked(listPosts).mockResolvedValue(seven);
    const alerts = await getOpsAlerts(me);
    expect(alerts.filter((a) => a.category === "공지")).toHaveLength(5);
  });

  it("me=null이면 빈 배열 — 다른 도메인과 일관", async () => {
    vi.mocked(listPosts).mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      noticeRow({ status: "active" }) as any,
    ]);
    const alerts = await getOpsAlerts(null);
    expect(alerts).toEqual([]);
  });

  it("listPosts는 'notice' 도메인으로 호출", async () => {
    vi.mocked(listPosts).mockResolvedValue([]);
    await getOpsAlerts(me);
    expect(listPosts).toHaveBeenCalledWith("notice");
  });
});

describe("getOpsAlerts — 미수채권 알림 포맷", () => {
  const meRcv = { email: "ys1114@x.com", displayName: "송영신" };

  function setupSheet(rows: ReturnType<typeof rcvRow>[]) {
    // fetchReceivablesSheet가 truthy면 매핑 로직 진입. rows 자체는 receivablesToListRow가 처리.
    vi.mocked(fetchReceivablesSheet).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows: rows.map(() => []) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(receivablesToListRow).mockImplementation((_sheet, idx) => rows[idx]);
  }

  it("학교명+금액 모두 있는 active row → label='학교명 · 금액', time='미수금'", async () => {
    setupSheet([rcvRow({ name: "부산대학교", author: "1,500,000", owner: "송영신" })]);
    const alerts = await getOpsAlerts(meRcv);
    const r = alerts.find((a) => a.category === "미수채권");
    expect(r).toBeDefined();
    expect(r?.label).toBe("부산대학교 · 1,500,000");
    expect(r?.time).toBe("미수금");
  });

  it("금액이 빈 row → 알림 제외", async () => {
    setupSheet([rcvRow({ name: "부산대학교", author: "", owner: "송영신" })]);
    const alerts = await getOpsAlerts(meRcv);
    expect(alerts.filter((a) => a.category === "미수채권")).toHaveLength(0);
  });

  it("학교명이 빈 row → 알림 제외 (합계/소계 등)", async () => {
    setupSheet([rcvRow({ name: "", author: "100,000", owner: "송영신" })]);
    const alerts = await getOpsAlerts(meRcv);
    expect(alerts.filter((a) => a.category === "미수채권")).toHaveLength(0);
  });

  it("approved(입금완료) row → 알림 제외 (기존 active 필터 유지)", async () => {
    setupSheet([
      rcvRow({ name: "A대학교", author: "100,000", owner: "송영신", status: "approved" }),
      rcvRow({ name: "B대학교", author: "200,000", owner: "송영신", status: "active" }),
    ]);
    const alerts = await getOpsAlerts(meRcv);
    const labels = alerts.filter((a) => a.category === "미수채권").map((a) => a.label);
    expect(labels).toEqual(["B대학교 · 200,000"]);
  });

  it("owner != me.displayName → 제외 (기존 본인 필터 유지)", async () => {
    setupSheet([rcvRow({ name: "A", author: "100,000", owner: "다른사람" })]);
    const alerts = await getOpsAlerts(meRcv);
    expect(alerts.filter((a) => a.category === "미수채권")).toHaveLength(0);
  });
});
