import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetCurrentOperator,
  mockUpdateChain,
  mockInsertChain,
  mockInsertPayload,
  mockUpdatePayload,
} = vi.hoisted(() => ({
  mockGetCurrentOperator: vi.fn(),
  mockUpdateChain: vi.fn(),
  mockInsertChain: vi.fn(),
  mockInsertPayload: vi.fn(),
  mockUpdatePayload: vi.fn(),
}));

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      insert: (payload: unknown) => {
        mockInsertPayload(payload);
        return { select: () => ({ single: mockInsertChain }) };
      },
      update: (payload: unknown) => {
        mockUpdatePayload(payload);
        return {
          eq: () => ({
            select: () => ({ single: mockUpdateChain }),
          }),
        };
      },
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

const memberMe = {
  ...adminMe,
  email: "member@example.com",
  permission: "member" as const,
};
const viewerMe = {
  ...adminMe,
  email: "viewer@example.com",
  permission: "viewer" as const,
};

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
  mockInsertPayload.mockReset();
  mockUpdatePayload.mockReset();
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

  it("createOperator — viewer 호출 시 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(viewerMe);
    const r = await createOperator(validCreate);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/권한/);
    expect(mockInsertChain).not.toHaveBeenCalled();
  });

  it("updateOperator — viewer 호출 시 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(viewerMe);
    const r = await updateOperator("00000000-0000-0000-0000-000000000001", {
      status: "inactive",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/권한/);
    expect(mockUpdateChain).not.toHaveBeenCalled();
  });

  it("restoreOperator — viewer 호출 시 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(viewerMe);
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

// 배정 대상 여부와 연차 그룹은 배정의 근거가 된다 — 아무나 켜면 배정이 흔들린다.
describe("배정 칸 저장 권한", () => {
  it("updateOperator — member가 tenure_group을 바꾸려 하면 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    const r = await updateOperator("00000000-0000-0000-0000-000000000001", {
      tenure_group: "3",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/권한/);
    expect(mockUpdateChain).not.toHaveBeenCalled();
  });

  it("updateOperator — viewer가 assignable을 켜려 하면 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(viewerMe);
    const r = await updateOperator("00000000-0000-0000-0000-000000000001", {
      assignable: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/권한/);
    expect(mockUpdateChain).not.toHaveBeenCalled();
  });

  it("updateOperator — admin은 배정 칸 셋을 저장한다", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockUpdateChain.mockResolvedValue({
      data: { id: "x", email: "other@example.com" },
      error: null,
    });
    const r = await updateOperator("00000000-0000-0000-0000-000000000001", {
      assignable: true,
      tenure_group: "1-2",
      career_start_at: "2011-02-07",
    });
    expect(r.ok).toBe(true);
    expect(mockUpdateChain).toHaveBeenCalled();
  });

  it("updateOperator — 미등록 그룹은 admin이라도 거부된다", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    const r = await updateOperator("00000000-0000-0000-0000-000000000001", {
      tenure_group: "7",
    });
    expect(r.ok).toBe(false);
    expect(mockUpdateChain).not.toHaveBeenCalled();
  });
});

describe("영업팀 — 부서는 영업부", () => {
  it("createOperator — 영업팀으로 등록하면 department 를 영업부로 넣는다(운영부 뉴스레터 제외)", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockInsertChain.mockResolvedValue({ data: { id: "x" }, error: null });
    await createOperator({ ...validCreate, team: "영업팀", permission: "viewer" });
    expect(mockInsertPayload.mock.calls[0][0]).toMatchObject({
      team: "영업팀",
      department: "영업부",
    });
  });

  it("createOperator — 운영팀은 운영부", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockInsertChain.mockResolvedValue({ data: { id: "x" }, error: null });
    await createOperator(validCreate);
    expect(mockInsertPayload.mock.calls[0][0]).toMatchObject({ department: "운영부" });
  });

  it("updateOperator — 영업팀에서 운영팀으로 옮기면 운영부로 돌아온다", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockUpdateChain.mockResolvedValue({ data: { id: "x" }, error: null });
    await updateOperator("00000000-0000-0000-0000-000000000001", { team: "운영2팀" });
    expect(mockUpdatePayload.mock.calls[0][0]).toMatchObject({ department: "운영부" });
  });

  it("updateOperator — 팀을 안 바꾸면 department 도 안 보낸다", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockUpdateChain.mockResolvedValue({ data: { id: "x" }, error: null });
    await updateOperator("00000000-0000-0000-0000-000000000001", { name: "새이름" });
    expect(mockUpdatePayload.mock.calls[0][0]).not.toHaveProperty("department");
  });

  it("updateOperator — 팀을 영업팀으로 바꾸면 department 도 영업부", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockUpdateChain.mockResolvedValue({ data: { id: "x" }, error: null });
    await updateOperator("00000000-0000-0000-0000-000000000001", { team: "영업팀" });
    expect(mockUpdatePayload.mock.calls[0][0]).toMatchObject({
      team: "영업팀",
      department: "영업부",
    });
  });
});
