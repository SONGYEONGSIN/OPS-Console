import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient, mockResult, eqCalls } = vi.hoisted(() => {
  const mockResult = vi.fn();
  const eqCalls: Array<[string, unknown]> = [];

  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = (col: string, val: unknown) => {
    eqCalls.push([col, val]);
    return builder;
  };
  builder.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(mockResult()).then(onFulfilled);

  const mockCreateClient = vi.fn(async () => ({
    from: () => builder,
  }));
  return { mockCreateClient, mockResult, eqCalls };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { incidentIdsWithPendingApprovalFor } from "../queries";

describe("incidentIdsWithPendingApprovalFor", () => {
  beforeEach(() => {
    mockResult.mockReset();
    eqCalls.length = 0;
  });

  it("빈 approverEmail → 빈 배열 (DB 미조회)", async () => {
    const r = await incidentIdsWithPendingApprovalFor("");
    expect(r).toEqual([]);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("status='pending_approval' + approver_email eq 필터로 incident_id 추출", async () => {
    mockResult.mockReturnValue({
      data: [
        { incident_id: "a" },
        { incident_id: "b" },
      ],
      error: null,
    });
    const r = await incidentIdsWithPendingApprovalFor("lead@example.com");
    expect(r).toEqual(["a", "b"]);
    expect(eqCalls).toContainEqual(["status", "pending_approval"]);
    expect(eqCalls).toContainEqual(["approver_email", "lead@example.com"]);
  });

  it("incident_id null 행은 제외", async () => {
    mockResult.mockReturnValue({
      data: [{ incident_id: null }, { incident_id: "c" }],
      error: null,
    });
    const r = await incidentIdsWithPendingApprovalFor("lead@example.com");
    expect(r).toEqual(["c"]);
  });

  it("data 없음 → 빈 배열", async () => {
    mockResult.mockReturnValue({ data: null, error: null });
    const r = await incidentIdsWithPendingApprovalFor("lead@example.com");
    expect(r).toEqual([]);
  });
});
