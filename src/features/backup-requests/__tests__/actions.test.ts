import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * supabase 모킹 — backup_requests insert(.select.single) + backup_request_services insert.
 * from("table")에 따라 분기. join insert는 mockJoinInsertResult가 제어.
 */
const { mockInsertResult, mockJoinInsertResult, mockGetCurrentOperator } =
  vi.hoisted(() => {
    const mockInsertResult = vi.fn();
    const mockJoinInsertResult = vi.fn();
    const mockGetCurrentOperator = vi.fn();
    return {
      mockInsertResult,
      mockJoinInsertResult,
      mockGetCurrentOperator,
    };
  });

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => {
      if (table === "backup_request_services") {
        return {
          insert: () => Promise.resolve(mockJoinInsertResult()),
        };
      }
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve(mockInsertResult()),
          }),
        }),
      };
    },
  })),
}));

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));

import { createBackupRequest } from "../actions";

const validInput = {
  substitute_email: "alice@example.com",
  substitute_name: "Alice",
  services: [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ],
  contacts: ["c1"],
  summary_md: "백업 내용",
  leave_start_date: "2026-05-20",
  leave_end_date: "2026-05-25",
};

const meOperator = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  email: "bob@example.com",
  team: "ops",
  permission: "member",
  displayName: "Bob",
};

const parentRow = {
  id: "33333333-3333-4333-8333-333333333333",
  requester_email: "bob@example.com",
  requester_team: "ops",
  substitute_email: "alice@example.com",
  substitute_name: "Alice",
  contacts: ["c1"],
  summary_md: "백업 내용",
  leave_start_date: "2026-05-20",
  leave_end_date: "2026-05-25",
  mail_status: "pending",
  mail_sent_at: null,
  mail_error: null,
  created_at: "2026-05-13T00:00:00Z",
  updated_at: "2026-05-13T00:00:00Z",
};

describe("createBackupRequest", () => {
  beforeEach(() => {
    mockInsertResult.mockReset();
    mockJoinInsertResult.mockReset();
    mockGetCurrentOperator.mockReset();
  });

  it("정상 입력 + 인증 → 부모 insert + join rows insert → ok", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockInsertResult.mockReturnValue({ data: parentRow, error: null });
    mockJoinInsertResult.mockReturnValue({ data: null, error: null });

    const r = await createBackupRequest(validInput);
    expect(r.ok).toBe(true);
    expect(mockJoinInsertResult).toHaveBeenCalledOnce();
  });

  it("services 빈 배열 → join insert 호출 안 함", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockInsertResult.mockReturnValue({ data: parentRow, error: null });
    mockJoinInsertResult.mockReturnValue({ data: null, error: null });

    const r = await createBackupRequest({ ...validInput, services: [] });
    expect(r.ok).toBe(true);
    expect(mockJoinInsertResult).not.toHaveBeenCalled();
  });

  it("join insert 실패 → ok=false (services FK 저장 실패 메시지)", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockInsertResult.mockReturnValue({ data: parentRow, error: null });
    mockJoinInsertResult.mockReturnValue({
      data: null,
      error: { message: "FK violation" },
    });

    const r = await createBackupRequest(validInput);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("services FK");
  });

  it("zod 실패 (uuid 형식 아님) → ok=false", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    const r = await createBackupRequest({
      ...validInput,
      services: ["not-a-uuid"],
    });
    expect(r.ok).toBe(false);
  });

  it("self 차단 — substitute == requester → ok=false", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    const r = await createBackupRequest({
      ...validInput,
      substitute_email: meOperator.email,
    });
    expect(r.ok).toBe(false);
  });

  it("비인증 (getCurrentOperator null) → ok=false", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const r = await createBackupRequest(validInput);
    expect(r.ok).toBe(false);
  });

  it("부모 insert 실패 → join insert 호출 안 함", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockInsertResult.mockReturnValue({
      data: null,
      error: { message: "DB error" },
    });

    const r = await createBackupRequest(validInput);
    expect(r.ok).toBe(false);
    expect(mockJoinInsertResult).not.toHaveBeenCalled();
  });
});
