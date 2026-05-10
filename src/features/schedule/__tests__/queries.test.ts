import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient, mockOrder, mockMaybeSingle } = vi.hoisted(() => {
  const mockOrder = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockCreateClient = vi.fn(async () => ({
    from: () => ({
      select: () => ({
        order: mockOrder,
        eq: () => ({ maybeSingle: mockMaybeSingle }),
      }),
    }),
  }));
  return { mockCreateClient, mockOrder, mockMaybeSingle };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { listScheduleEvents, getScheduleEventById } from "../queries";

const validRow = {
  id: "a1b2c3d4-1234-4567-89ab-123456789012",
  type: "event",
  title: "주간 운영 회의",
  description: null,
  start_at: "2026-05-15T01:00:00Z",
  end_at: "2026-05-15T02:00:00Z",
  all_day: false,
  assignee_email: null,
  created_by_email: "ys1114@jinhakapply.com",
  created_at: "2026-05-09T00:00:00Z",
  updated_at: "2026-05-09T00:00:00Z",
};

describe("listScheduleEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DB에서 fetch한 row를 zod parse 후 반환", async () => {
    mockOrder.mockResolvedValueOnce({ data: [validRow], error: null });
    const rows = await listScheduleEvents();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("주간 운영 회의");
  });

  it("supabase error → 빈 배열", async () => {
    mockOrder.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });
    const rows = await listScheduleEvents();
    expect(rows).toEqual([]);
  });

  it("zod parse 실패 row는 skip (다른 row는 유지)", async () => {
    const broken = { ...validRow, id: "not-a-uuid" };
    mockOrder.mockResolvedValueOnce({
      data: [broken, validRow],
      error: null,
    });
    const rows = await listScheduleEvents();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(validRow.id);
  });
});

describe("getScheduleEventById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("매칭 row → 반환", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: validRow, error: null });
    const row = await getScheduleEventById(validRow.id);
    expect(row?.title).toBe(validRow.title);
  });

  it("매칭 없음 → null", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const row = await getScheduleEventById("missing");
    expect(row).toBeNull();
  });
});
