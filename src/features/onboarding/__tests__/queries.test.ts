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

import { listCohorts, getCohortById } from "../queries";

const validRow = {
  id: "a1b2c3d4-1234-4567-89ab-123456789012",
  title: "회차 1",
  trainee_email: "kjn@jinhakapply.com",
  mentor_email: "ys1114@jinhakapply.com",
  start_date: "2026-05-14",
  end_date: "2026-05-25",
  status: "in_progress",
  notes: null,
  created_at: "2026-05-10T00:00:00Z",
  updated_at: "2026-05-10T00:00:00Z",
};

describe("listCohorts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DB row를 zod parse 후 반환", async () => {
    mockOrder.mockResolvedValueOnce({ data: [validRow], error: null });
    const rows = await listCohorts();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("회차 1");
  });

  it("supabase error → 빈 배열", async () => {
    mockOrder.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });
    const rows = await listCohorts();
    expect(rows).toEqual([]);
  });
});

describe("getCohortById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("매칭 row → 반환", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: validRow, error: null });
    const row = await getCohortById(validRow.id);
    expect(row?.title).toBe("회차 1");
  });

  it("매칭 없음 → null", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const row = await getCohortById("missing");
    expect(row).toBeNull();
  });
});
