import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient, mockOrder, mockEq } = vi.hoisted(() => {
  const mockOrder = vi.fn();
  const mockEq = vi.fn(() => ({ order: mockOrder }));
  const mockCreateClient = vi.fn(async () => ({
    from: () => ({
      select: () => ({ eq: mockEq }),
    }),
  }));
  return { mockCreateClient, mockOrder, mockEq };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

const mockGetCurrentOperator = vi.hoisted(() => vi.fn());
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));

import { listMyTodos } from "../queries";

const validRow = {
  id: "a1b2c3d4-1234-4567-89ab-123456789012",
  title: "할 일 1",
  body: null,
  done: false,
  done_at: null,
  due_at: null,
  priority: "medium",
  assignee_email: "ys1114@jinhakapply.com",
  created_by_email: "ys1114@jinhakapply.com",
  created_at: "2026-05-09T00:00:00Z",
  updated_at: "2026-05-09T00:00:00Z",
};

describe("listMyTodos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("로그인 안 된 상태 → 빈 배열", async () => {
    mockGetCurrentOperator.mockResolvedValueOnce(null);
    const rows = await listMyTodos();
    expect(rows).toEqual([]);
  });

  it("본인 email로 필터한 row를 zod parse 후 반환", async () => {
    mockGetCurrentOperator.mockResolvedValueOnce({
      email: "ys1114@jinhakapply.com",
      permission: "admin",
    });
    mockOrder.mockResolvedValueOnce({ data: [validRow], error: null });
    const rows = await listMyTodos();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("할 일 1");
    expect(mockEq).toHaveBeenCalledWith(
      "assignee_email",
      "ys1114@jinhakapply.com",
    );
  });

  it("supabase error → 빈 배열", async () => {
    mockGetCurrentOperator.mockResolvedValueOnce({
      email: "ys1114@jinhakapply.com",
      permission: "member",
    });
    mockOrder.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });
    const rows = await listMyTodos();
    expect(rows).toEqual([]);
  });

  it("zod parse 실패 row는 skip", async () => {
    mockGetCurrentOperator.mockResolvedValueOnce({
      email: "ys1114@jinhakapply.com",
      permission: "admin",
    });
    const broken = { ...validRow, id: "not-uuid" };
    mockOrder.mockResolvedValueOnce({
      data: [broken, validRow],
      error: null,
    });
    const rows = await listMyTodos();
    expect(rows).toHaveLength(1);
  });
});
