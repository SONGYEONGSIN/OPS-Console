import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient, mockEq } = vi.hoisted(() => {
  const mockEq = vi.fn();
  const mockCreateClient = vi.fn(async () => ({
    from: () => ({
      select: () => ({ eq: mockEq }),
    }),
  }));
  return { mockCreateClient, mockEq };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { listChecklistByCohort } from "../checklist-queries";

const validRow = {
  id: "a1b2c3d4-1234-4567-89ab-123456789012",
  cohort_id: "b2c3d4e5-1234-4567-89ab-123456789012",
  section_key: "입사 및 계정 설정",
  item_key: "인사 및 자리 안내",
  checked: true,
  checked_at: "2026-05-17T10:00:00Z",
  created_at: "2026-05-17T09:00:00Z",
  updated_at: "2026-05-17T10:00:00Z",
};

describe("listChecklistByCohort", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cohortId로 필터한 row를 반환", async () => {
    mockEq.mockResolvedValueOnce({ data: [validRow], error: null });
    const rows = await listChecklistByCohort(validRow.cohort_id);
    expect(rows).toHaveLength(1);
    expect(rows[0].item_key).toBe("인사 및 자리 안내");
  });

  it("supabase error → 빈 배열", async () => {
    mockEq.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const rows = await listChecklistByCohort("missing");
    expect(rows).toEqual([]);
  });

  it("cohort_id 빈 문자열 → 빈 배열 (fetch 안 함)", async () => {
    const rows = await listChecklistByCohort("");
    expect(rows).toEqual([]);
    expect(mockEq).not.toHaveBeenCalled();
  });
});
