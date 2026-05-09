import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient, mockOrder } = vi.hoisted(() => {
  const mockOrder = vi.fn();
  const mockCreateClient = vi.fn(async () => ({
    from: () => ({
      select: () => ({
        order: () => ({ order: mockOrder }),
      }),
      eq: () => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }));
  return { mockCreateClient, mockOrder };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { listOperators } from "../queries";

const validRow = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  email: "test@example.com",
  name: "홍길동",
  team: "운영1팀",
  role: "매니저",
  emp_no: "20240101",
  hired_at: "2024-01-01",
  birth_date: "1990-01-01",
  gender: "남",
  division: "어플라이사업본부",
  department: "운영부",
  status: "active",
  permission: "member",
  leader: null,
  created_at: "2026-05-09T00:00:00Z",
  updated_at: "2026-05-09T00:00:00Z",
};

describe("listOperators", () => {
  beforeEach(() => {
    mockOrder.mockReset();
  });

  it("정상 row 반환 + zod parse", async () => {
    mockOrder.mockResolvedValue({ data: [validRow], error: null });
    const ops = await listOperators();
    expect(ops.length).toBe(1);
    expect(ops[0].name).toBe("홍길동");
    expect(ops[0].permission).toBe("member");
  });

  it("permission 잘못된 enum row는 skip", async () => {
    mockOrder.mockResolvedValue({
      data: [validRow, { ...validRow, permission: "BAD" }],
      error: null,
    });
    const ops = await listOperators();
    expect(ops.length).toBe(1);
  });

  it("error → 빈 배열", async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: "boom" } });
    const ops = await listOperators();
    expect(ops).toEqual([]);
  });

  it("zod fail row는 skip", async () => {
    mockOrder.mockResolvedValue({
      data: [validRow, { ...validRow, status: "BAD" }],
      error: null,
    });
    const ops = await listOperators();
    expect(ops.length).toBe(1);
  });
});
