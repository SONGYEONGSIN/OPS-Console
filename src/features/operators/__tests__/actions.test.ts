import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetCurrentOperator, mockUpdateChain, mockInsertChain } = vi.hoisted(
  () => ({
    mockGetCurrentOperator: vi.fn(),
    mockUpdateChain: vi.fn(),
    mockInsertChain: vi.fn(),
  })
);

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      insert: () => ({
        select: () => ({ single: mockInsertChain }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({ single: mockUpdateChain }),
        }),
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { email: "other@example.com" },
            error: null,
          }),
        }),
      }),
    }),
  })),
}));

import { createOperator, updateOperator, restoreOperator } from "../actions";

const adminMe = {
  email: "admin@example.com",
  displayName: "admin",
  role: "팀장",
  team: "운영2팀" as const,
  operator: null,
  permission: "admin" as const,
};

const memberMe = { ...adminMe, email: "member@example.com", permission: "member" as const };

const validCreate = {
  email: "new@example.com",
  name: "신규",
  team: "운영1팀",
  role: "매니저",
  emp_no: "20260101",
  hired_at: "2026-01-01",
  birth_date: "2000-01-01",
  gender: "여",
};

beforeEach(() => {
  mockGetCurrentOperator.mockReset();
  mockUpdateChain.mockReset();
  mockInsertChain.mockReset();
});

describe("admin 가드", () => {
  it("createOperator — member 호출 시 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    const r = await createOperator(validCreate);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/권한/);
    expect(mockInsertChain).not.toHaveBeenCalled();
  });

  it("updateOperator — member 호출 시 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    const r = await updateOperator("00000000-0000-0000-0000-000000000001", {
      status: "inactive",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/권한/);
    expect(mockUpdateChain).not.toHaveBeenCalled();
  });

  it("restoreOperator — member 호출 시 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    const r = await restoreOperator("00000000-0000-0000-0000-000000000001");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/권한/);
    expect(mockUpdateChain).not.toHaveBeenCalled();
  });

  it("createOperator — admin 호출 시 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockInsertChain.mockResolvedValue({
      data: { id: "x", email: "new@example.com" },
      error: null,
    });
    const r = await createOperator(validCreate);
    expect(r.ok).toBe(true);
    expect(mockInsertChain).toHaveBeenCalled();
  });

  it("updateOperator — admin이 다른 사용자 강등 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockUpdateChain.mockResolvedValue({
      data: { id: "x", email: "other@example.com" },
      error: null,
    });
    // target row의 email='other@...' 이라 me.email !== target → 본인 강등 아님
    const r = await updateOperator("00000000-0000-0000-0000-000000000001", {
      permission: "member",
    });
    expect(r.ok).toBe(true);
  });
});

describe("본인 강등 차단", () => {
  it("updateOperator — admin이 자기 자신을 member로 강등 시 차단", async () => {
    // me.email == target.email로 만들기 위해 target lookup mock 재정의
    mockGetCurrentOperator.mockResolvedValue({
      ...adminMe,
      email: "other@example.com", // target과 동일
    });
    const r = await updateOperator("00000000-0000-0000-0000-000000000001", {
      permission: "member",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/본인/);
    expect(mockUpdateChain).not.toHaveBeenCalled();
  });

  it("updateOperator — admin이 자기 자신의 다른 필드 변경은 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      ...adminMe,
      email: "other@example.com",
    });
    mockUpdateChain.mockResolvedValue({
      data: { id: "x", email: "other@example.com" },
      error: null,
    });
    const r = await updateOperator("00000000-0000-0000-0000-000000000001", {
      name: "이름만 변경",
    });
    expect(r.ok).toBe(true);
  });
});
