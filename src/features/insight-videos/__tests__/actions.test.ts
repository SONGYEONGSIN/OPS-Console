import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetCurrentOperator, mockDelete, mockBlocklistUpsert, mockLogActivity } =
  vi.hoisted(() => ({
    mockGetCurrentOperator: vi.fn(),
    mockDelete: vi.fn(),
    mockBlocklistUpsert: vi.fn(),
    mockLogActivity: vi.fn(),
  }));

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/features/worklog/log", () => ({ logActivity: mockLogActivity }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "insight_video_blocklist") {
        return { upsert: mockBlocklistUpsert };
      }
      return {
        delete: () => ({
          eq: () => ({
            select: () => ({ maybeSingle: mockDelete }),
          }),
        }),
      };
    },
  })),
}));

import { deleteInsightVideo } from "../actions";

const adminMe = {
  email: "admin@x.com",
  displayName: "admin",
  permission: "admin" as const,
};
const memberMe = { ...adminMe, email: "m@x.com", permission: "member" as const };

const VALID_ID = "11111111-1111-4111-8111-111111111111";
const row = { id: VALID_ID, title: "테스트 영상", video_id: "abc123" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteInsightVideo", () => {
  it("admin이 아니면 권한 오류 + delete 미호출", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    const res = await deleteInsightVideo(VALID_ID);
    expect(res.ok).toBe(false);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("비로그인(null)이면 권한 오류", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const res = await deleteInsightVideo(VALID_ID);
    expect(res.ok).toBe(false);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("uuid 형식이 아니면 검증 오류 + delete 미호출", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    const res = await deleteInsightVideo("not-a-uuid");
    expect(res.ok).toBe(false);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("admin + 유효 id → 삭제 성공 + blocklist 등록 + logActivity 기록", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockDelete.mockResolvedValue({ data: row, error: null });
    mockBlocklistUpsert.mockResolvedValue({ error: null });
    const res = await deleteInsightVideo(VALID_ID);
    expect(res).toEqual({ ok: true, row: { id: VALID_ID, title: "테스트 영상" } });
    expect(mockBlocklistUpsert).toHaveBeenCalledTimes(1);
    expect(mockBlocklistUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ video_id: "abc123" }),
      expect.objectContaining({ onConflict: "video_id" }),
    );
    expect(mockLogActivity).toHaveBeenCalledTimes(1);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "ai-insight",
        action: "delete",
        target_id: VALID_ID,
      }),
    );
  });

  it("이미 없는 행(data=null) → 실패", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockDelete.mockResolvedValue({ data: null, error: null });
    const res = await deleteInsightVideo(VALID_ID);
    expect(res.ok).toBe(false);
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it("supabase 오류 → 실패", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockDelete.mockResolvedValue({ data: null, error: { message: "db down" } });
    const res = await deleteInsightVideo(VALID_ID);
    expect(res).toEqual({ ok: false, error: "db down" });
  });
});
