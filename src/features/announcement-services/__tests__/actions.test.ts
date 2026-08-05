import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  from: vi.fn(),
  upsert: vi.fn(),
  getCurrentOperator: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: h.from }),
}));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: h.getCurrentOperator,
}));
vi.mock("@/features/worklog/log", () => ({ logActivity: h.logActivity }));

import { upsertAnnouncementServicesBulk } from "../actions";

const ROW = {
  service_id: 300416,
  university_id: 3004,
  university_name: "국립한밭대학교",
  service_name: "[등록금]외국인 합격자발표(전기)",
  last_announce_at: "2026-01-12T05:00:00.000Z",
};

describe("upsertAnnouncementServicesBulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getCurrentOperator.mockResolvedValue({
      email: "me@x.com",
      permission: "member",
    });
    h.upsert.mockResolvedValue({ error: null });
    h.from.mockReturnValue({ upsert: h.upsert });
  });

  it("서비스ID 기준 upsert — 재업로드하면 이름·발표일이 갱신된다", async () => {
    const r = await upsertAnnouncementServicesBulk([ROW]);

    expect(r.ok).toBe(true);
    expect(r.upserted).toBe(1);
    expect(h.from).toHaveBeenCalledWith("announcement_services");
    const [payload, opts] = h.upsert.mock.calls[0];
    expect(payload).toEqual([ROW]);
    expect(opts).toMatchObject({ onConflict: "service_id" });
  });

  it("권한 없으면 아무것도 쓰지 않는다", async () => {
    // viewer 등 운영 권한이 없는 계정
    h.getCurrentOperator.mockResolvedValue({
      email: "v@x.com",
      permission: "viewer",
    });
    const r = await upsertAnnouncementServicesBulk([ROW]);
    expect(r.ok).toBe(false);
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("형식이 깨진 행은 걸러내고 나머지만 넣는다", async () => {
    const broken = { ...ROW, service_id: -1 };
    const r = await upsertAnnouncementServicesBulk([ROW, broken]);
    expect(r.upserted).toBe(1);
    expect(h.upsert.mock.calls[0][0]).toHaveLength(1);
  });

  it("넣을 게 없으면 DB를 건드리지 않는다", async () => {
    const r = await upsertAnnouncementServicesBulk([]);
    expect(r.ok).toBe(true);
    expect(r.upserted).toBe(0);
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("DB 오류는 삼키지 않고 그대로 돌려준다", async () => {
    h.upsert.mockResolvedValue({ error: { message: "boom" } });
    const r = await upsertAnnouncementServicesBulk([ROW]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("boom");
  });
});
