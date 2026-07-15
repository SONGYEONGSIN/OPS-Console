import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateAdminClient, state } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  state: { result: { data: [] as unknown, error: null as unknown } },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

import { listLatestDevControlRequests } from "../requests-query";

function builder() {
  const b: Record<string, unknown> = {
    then: (resolve: (v: unknown) => void) => resolve(state.result),
  };
  for (const m of ["select", "order"]) b[m] = vi.fn(() => b);
  return b;
}

describe("listLatestDevControlRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.result = { data: [], error: null };
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder()) });
  });

  it("service_id별 최신 요청 1건만 유지 (requested_at desc 첫 건)", async () => {
    state.result = {
      data: [
        { id: "r2", service_id: 7, status: "running", requested_at: "2026-07-15T02:00:00Z" },
        { id: "r1", service_id: 7, status: "done", requested_at: "2026-07-15T01:00:00Z" },
        { id: "r3", service_id: 9, status: "pending", requested_at: "2026-07-15T00:00:00Z" },
      ],
      error: null,
    };
    const map = await listLatestDevControlRequests();
    expect(map.size).toBe(2);
    expect(map.get(7)?.id).toBe("r2");
    expect(map.get(9)?.status).toBe("pending");
  });

  it("조회 에러 → throw", async () => {
    state.result = { data: null, error: { message: "boom" } };
    await expect(listLatestDevControlRequests()).rejects.toThrow(
      "요청 조회 실패: boom",
    );
  });
});
