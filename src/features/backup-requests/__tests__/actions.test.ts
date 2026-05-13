import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInsertResult, mockGetCurrentOperator } = vi.hoisted(() => {
  const mockInsertResult = vi.fn();
  const mockGetCurrentOperator = vi.fn();
  return { mockInsertResult, mockGetCurrentOperator };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve(mockInsertResult()),
        }),
      }),
    }),
  })),
}));

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));

import { createBackupRequest } from "../actions";

const validInput = {
  substitute_email: "alice@example.com",
  substitute_name: "Alice",
  services: ["s1"],
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

describe("createBackupRequest", () => {
  beforeEach(() => {
    mockInsertResult.mockReset();
    mockGetCurrentOperator.mockReset();
  });

  it("정상 입력 + 인증 → ok 반환", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockInsertResult.mockReturnValue({
      data: {
        id: "11111111-1111-1111-1111-111111111111",
        requester_email: "bob@example.com",
        requester_team: "ops",
        substitute_email: "alice@example.com",
        substitute_name: "Alice",
        services: ["s1"],
        contacts: ["c1"],
        summary_md: "백업 내용",
        leave_start_date: "2026-05-20",
        leave_end_date: "2026-05-25",
        mail_status: "pending",
        mail_sent_at: null,
        mail_error: null,
        created_at: "2026-05-13T00:00:00Z",
        updated_at: "2026-05-13T00:00:00Z",
      },
      error: null,
    });
    const r = await createBackupRequest(validInput);
    expect(r.ok).toBe(true);
  });

  it("zod 실패 → ok=false + 에러 메시지", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    const r = await createBackupRequest({ ...validInput, summary_md: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBeTruthy();
    }
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
});
