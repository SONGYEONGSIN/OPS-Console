import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetCurrentOperator, mockInsert, mockUpdate, mockDelete, mockTargetSelect } =
  vi.hoisted(() => ({
    mockGetCurrentOperator: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockTargetSelect: vi.fn(),
  }));

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      insert: () => ({
        select: () => ({ single: mockInsert }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({ single: mockUpdate }),
        }),
      }),
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

import { createPost, updatePost, deletePost } from "../actions";

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

const validFeedbackInput = {
  domain: "feedback" as const,
  title: "신규 개선",
  body: "본문",
  author_email: "member@x.com",
};

const validNoticeInput = {
  domain: "notice" as const,
  title: "신규 공지",
  body: "본문",
  author_email: "admin@x.com",
};

beforeEach(() => {
  mockGetCurrentOperator.mockReset();
  mockInsert.mockReset();
  mockUpdate.mockReset();
  mockDelete.mockReset();
  mockTargetSelect.mockReset();
});

describe("createPost", () => {
  it("viewer feedback 작성 → 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(viewerMe);
    const r = await createPost(validFeedbackInput);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/권한/);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("member feedback 작성 → 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockInsert.mockResolvedValue({
      data: { id: "x", ...validFeedbackInput, status: "urgent" },
      error: null,
    });
    const r = await createPost(validFeedbackInput);
    expect(r.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("member notice 작성 → 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    const r = await createPost(validNoticeInput);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/공지|admin/i);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("admin notice 작성 → 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockInsert.mockResolvedValue({
      data: { id: "x", ...validNoticeInput, status: "urgent" },
      error: null,
    });
    const r = await createPost(validNoticeInput);
    expect(r.ok).toBe(true);
  });
});

describe("updatePost / deletePost", () => {
  it("member가 본인 feedback 글 update → 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockTargetSelect.mockResolvedValue({
      data: { domain: "feedback", author_email: "member@x.com" },
      error: null,
    });
    mockUpdate.mockResolvedValue({
      data: { id: "x", domain: "feedback" },
      error: null,
    });
    const r = await updatePost("post-id", { title: "수정" });
    expect(r.ok).toBe(true);
  });

  it("member가 타인 feedback 글 update → 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockTargetSelect.mockResolvedValue({
      data: { domain: "feedback", author_email: "other@x.com" },
      error: null,
    });
    const r = await updatePost("post-id", { title: "수정" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/권한|작성자/);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("member가 notice 글 update → 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockTargetSelect.mockResolvedValue({
      data: { domain: "notice", author_email: "admin@x.com" },
      error: null,
    });
    const r = await updatePost("post-id", { title: "수정" });
    expect(r.ok).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("admin이 타인 글 update → 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockTargetSelect.mockResolvedValue({
      data: { domain: "feedback", author_email: "other@x.com" },
      error: null,
    });
    mockUpdate.mockResolvedValue({
      data: { id: "x", domain: "feedback" },
      error: null,
    });
    const r = await updatePost("post-id", { title: "수정" });
    expect(r.ok).toBe(true);
  });

  it("member가 본인 feedback 글 delete → 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockTargetSelect.mockResolvedValue({
      data: { domain: "feedback", author_email: "member@x.com" },
      error: null,
    });
    mockDelete.mockResolvedValue({ data: { id: "x" }, error: null });
    const r = await deletePost("post-id");
    expect(r.ok).toBe(true);
  });
});
