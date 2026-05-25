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
vi.mock("@/features/posts/queries", () => ({
  listPosts: vi.fn(),
}));

import { getOpsAlerts } from "../queries";
import { listPosts } from "@/features/posts/queries";

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
});

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
