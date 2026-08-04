import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: h.from }),
}));

import { isExcluded, loadRatioAuditExceptions } from "../exceptions";

describe("점검 예외", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.from.mockReturnValue({ select: h.select });
  });

  it("service_id + 차수가 맞으면 제외 대상", async () => {
    h.select.mockResolvedValue({
      data: [{ service_id: 100, seq: 1 }],
      error: null,
    });
    const ex = await loadRatioAuditExceptions();
    expect(isExcluded(ex, 100, 1)).toBe(true);
    // 차수가 다르면 별도 설정 페이지라 그대로 알린다
    expect(isExcluded(ex, 100, 2)).toBe(false);
    expect(isExcluded(ex, 999, 1)).toBe(false);
  });

  it("차수가 비어 있으면 모든 차수를 제외한다", async () => {
    h.select.mockResolvedValue({
      data: [{ service_id: 100, seq: null }],
      error: null,
    });
    const ex = await loadRatioAuditExceptions();
    expect(isExcluded(ex, 100, 1)).toBe(true);
    expect(isExcluded(ex, 100, 5)).toBe(true);
  });

  it("예외가 없으면 아무것도 제외하지 않는다", async () => {
    h.select.mockResolvedValue({ data: [], error: null });
    const ex = await loadRatioAuditExceptions();
    expect(isExcluded(ex, 100, 1)).toBe(false);
  });

  it("조회가 실패하면 삼키지 않는다 — 조용히 전건 발송되면 예외가 무의미해진다", async () => {
    h.select.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(loadRatioAuditExceptions()).rejects.toThrow(/boom/);
  });
});
