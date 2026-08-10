import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetCurrentOperator,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockTargetSelect,
  mockInsertArgs,
  mockUpdateArgs,
} = vi.hoisted(() => ({
  mockGetCurrentOperator: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockTargetSelect: vi.fn(),
  mockInsertArgs: vi.fn(),
  mockUpdateArgs: vi.fn(),
}));

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      insert: (payload: unknown) => {
        mockInsertArgs(payload);
        return { select: () => ({ single: mockInsert }) };
      },
      update: (payload: unknown) => {
        mockUpdateArgs(payload);
        return { eq: () => ({ select: () => ({ single: mockUpdate }) }) };
      },
      delete: () => ({
        eq: () => ({
          select: () => ({ maybeSingle: mockDelete }),
        }),
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: mockTargetSelect,
        }),
      }),
    }),
  })),
}));

import { createAiWork, updateAiWork, deleteAiWork } from "../actions";

const adminMe = {
  email: "admin@x.com",
  displayName: "admin",
  role: "팀장",
  team: "운영2팀" as const,
  operator: null,
  permission: "admin" as const,
  allowedMenus: [] as string[],
};

const memberMe = {
  ...adminMe,
  email: "member@x.com",
  permission: "member" as const,
};
const viewerMe = {
  ...adminMe,
  email: "viewer@x.com",
  permission: "viewer" as const,
};

const validInput = {
  title: "회의록 요약 자동화",
  work_start_date: "2026-05-10",
  work_end_date: "2026-05-12",
  ai_tool: "chatgpt" as const,
  category: "meeting" as const,
  summary_md: "주간회의 30분 → 5분.",
  tags: ["회의록"],
};

const insertPayload = () =>
  mockInsertArgs.mock.calls.at(-1)?.[0] as Record<string, unknown>;
const updatePayload = () =>
  mockUpdateArgs.mock.calls.at(-1)?.[0] as Record<string, unknown>;

beforeEach(() => {
  mockGetCurrentOperator.mockReset();
  mockInsert.mockReset();
  mockUpdate.mockReset();
  mockDelete.mockReset();
  mockTargetSelect.mockReset();
  mockInsertArgs.mockReset();
  mockUpdateArgs.mockReset();
});

describe("createAiWork", () => {
  it("viewer → 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(viewerMe);
    const r = await createAiWork(validInput);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/권한/);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("zod 실패 입력 → 거부", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    const r = await createAiWork({ ...validInput, title: "" });
    expect(r.ok).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("member → 통과 (author_email 자동 채움)", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockInsert.mockResolvedValue({
      data: {
        id: "x",
        ...validInput,
        author_email: "member@x.com",
        summary_md: validInput.summary_md,
      },
      error: null,
    });
    const r = await createAiWork(validInput);
    expect(r.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });
});

describe("updateAiWork", () => {
  it("본인 글 update → 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockTargetSelect.mockResolvedValue({
      data: { author_email: "member@x.com" },
      error: null,
    });
    mockUpdate.mockResolvedValue({ data: { id: "x" }, error: null });
    const r = await updateAiWork("x", { title: "수정" });
    expect(r.ok).toBe(true);
  });

  it("타인 글 update (member) → 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockTargetSelect.mockResolvedValue({
      data: { author_email: "other@x.com" },
      error: null,
    });
    const r = await updateAiWork("x", { title: "수정" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/작성자|권한/);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("admin은 타인 글도 update → 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockTargetSelect.mockResolvedValue({
      data: { author_email: "other@x.com" },
      error: null,
    });
    mockUpdate.mockResolvedValue({ data: { id: "x" }, error: null });
    const r = await updateAiWork("x", { title: "수정" });
    expect(r.ok).toBe(true);
  });

  it("target 없음 → not found", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockTargetSelect.mockResolvedValue({ data: null, error: null });
    const r = await updateAiWork("none", { title: "수정" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/찾을 수 없|not found/i);
  });
});

describe("deleteAiWork", () => {
  it("본인 글 delete → 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockTargetSelect.mockResolvedValue({
      data: { author_email: "member@x.com" },
      error: null,
    });
    mockDelete.mockResolvedValue({ data: { id: "x" }, error: null });
    const r = await deleteAiWork("x");
    expect(r.ok).toBe(true);
  });

  it("타인 글 delete (member) → 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockTargetSelect.mockResolvedValue({
      data: { author_email: "other@x.com" },
      error: null,
    });
    const r = await deleteAiWork("x");
    expect(r.ok).toBe(false);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe("공동작업자 정규화", () => {
  it("create: 등록자 본인과 중복을 제거하고 저장한다", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "member@x.com",
      permission: "member",
    });
    mockInsert.mockResolvedValue({
      data: { author_email: "member@x.com" },
      error: null,
    });

    await createAiWork({
      title: "제목",
      work_start_date: "2026-08-10",
      work_end_date: "2026-08-10",
      ai_tool: "claude",
      category: "code",
      summary_md: "요약",
      collaborator_emails: ["a@x.com", "member@x.com", "a@x.com"],
    });

    expect(insertPayload().collaborator_emails).toEqual(["a@x.com"]);
  });

  it("update: admin이 남의 글을 고쳐도 제외 기준은 등록자다", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockTargetSelect.mockResolvedValue({
      data: { author_email: "other@x.com" },
      error: null,
    });
    mockUpdate.mockResolvedValue({
      data: { author_email: "other@x.com" },
      error: null,
    });

    await updateAiWork("11111111-1111-4111-8111-111111111111", {
      collaborator_emails: ["other@x.com", "admin@x.com"],
    });

    // 등록자(other)는 빠지고 수정자(admin)는 남는다
    expect(updatePayload().collaborator_emails).toEqual(["admin@x.com"]);
  });

  it("update: 필드를 안 보내면 건드리지 않는다", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockTargetSelect.mockResolvedValue({
      data: { author_email: "other@x.com" },
      error: null,
    });
    mockUpdate.mockResolvedValue({
      data: { author_email: "other@x.com" },
      error: null,
    });

    await updateAiWork("11111111-1111-4111-8111-111111111111", {
      title: "수정",
    });

    expect("collaborator_emails" in updatePayload()).toBe(false);
  });
});
