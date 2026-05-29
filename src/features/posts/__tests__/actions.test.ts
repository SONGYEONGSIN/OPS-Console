import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetCurrentOperator,
  mockInsert,
  mockInsertCall,
  mockMaxSlug,
  mockUpdate,
  mockDelete,
  mockTargetSelect,
  mockSendOwnerNotify,
  mockSendStatusNotify,
} = vi.hoisted(() => ({
  mockGetCurrentOperator: vi.fn(),
  mockInsert: vi.fn(),
  mockInsertCall: vi.fn(),
  mockMaxSlug: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockTargetSelect: vi.fn(),
  mockSendOwnerNotify: vi.fn(),
  mockSendStatusNotify: vi.fn(),
}));

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));

vi.mock("../mailer", () => ({
  sendFeedbackOwnerNotify: mockSendOwnerNotify,
  sendFeedbackStatusNotify: mockSendStatusNotify,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      insert: (payload: unknown) => {
        mockInsertCall(payload);
        return { select: () => ({ single: mockInsert }) };
      },
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
          like: () => ({
            order: () => ({
              limit: () => ({ maybeSingle: mockMaxSlug }),
            }),
          }),
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
  mockInsertCall.mockReset();
  mockMaxSlug.mockReset();
  mockUpdate.mockReset();
  mockDelete.mockReset();
  mockTargetSelect.mockReset();
  mockSendOwnerNotify.mockReset();
  mockSendStatusNotify.mockReset();
  mockSendOwnerNotify.mockResolvedValue({ status: "skipped" });
  mockSendStatusNotify.mockResolvedValue({ status: "skipped" });
  // 기본: 기존 slug 없음
  mockMaxSlug.mockResolvedValue({ data: null, error: null });
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

describe("createPost — 메일 hook", () => {
  it("feedback 등록 성공 → sendFeedbackOwnerNotify 1회 호출", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    const created = {
      id: "post-uuid",
      domain: "feedback",
      slug: "FB-001",
      title: validFeedbackInput.title,
      body: validFeedbackInput.body,
      author_email: memberMe.email,
      author_id: null,
      owner_label: "송영신",
      status: "urgent",
      created_at: "2026-05-25T10:00:00+09:00",
      updated_at: "2026-05-25T10:00:00+09:00",
    };
    mockInsert.mockResolvedValue({ data: created, error: null });

    const r = await createPost(validFeedbackInput);
    expect(r.ok).toBe(true);
    expect(mockSendOwnerNotify).toHaveBeenCalledTimes(1);
    expect(mockSendOwnerNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        post: expect.objectContaining({ id: "post-uuid", domain: "feedback" }),
        senderEmail: memberMe.email,
      }),
    );
    expect(mockSendStatusNotify).not.toHaveBeenCalled();
  });

  it("notice 등록 성공 → 메일 hook 미호출", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockInsert.mockResolvedValue({
      data: {
        id: "x",
        domain: "notice",
        title: validNoticeInput.title,
        author_email: adminMe.email,
        status: "urgent",
      },
      error: null,
    });
    await createPost(validNoticeInput);
    expect(mockSendOwnerNotify).not.toHaveBeenCalled();
    expect(mockSendStatusNotify).not.toHaveBeenCalled();
  });

  it("메일 hook 실패해도 createPost는 ok 유지", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockInsert.mockResolvedValue({
      data: {
        id: "x",
        domain: "feedback",
        title: "t",
        author_email: memberMe.email,
        status: "urgent",
      },
      error: null,
    });
    mockSendOwnerNotify.mockRejectedValueOnce(new Error("graph down"));
    const r = await createPost(validFeedbackInput);
    expect(r.ok).toBe(true);
  });
});

describe("updatePost — 상태 변경 메일 hook", () => {
  it("feedback status 변경 (urgent→active) → sendFeedbackStatusNotify 호출", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockTargetSelect.mockResolvedValue({
      data: {
        domain: "feedback",
        author_email: "member@x.com",
        status: "urgent",
      },
      error: null,
    });
    const updated = {
      id: "post-uuid",
      domain: "feedback",
      slug: "FB-001",
      title: "검색창",
      body: null,
      author_email: "member@x.com",
      author_id: null,
      owner_label: "송영신",
      status: "active",
      created_at: "2026-05-25T10:00:00+09:00",
      updated_at: "2026-05-25T10:05:00+09:00",
    };
    mockUpdate.mockResolvedValue({ data: updated, error: null });

    const r = await updatePost("post-uuid", { status: "active" });
    expect(r.ok).toBe(true);
    expect(mockSendStatusNotify).toHaveBeenCalledTimes(1);
    expect(mockSendStatusNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        post: expect.objectContaining({ id: "post-uuid" }),
        statusTo: "active",
        senderEmail: adminMe.email,
      }),
    );
    expect(mockSendOwnerNotify).not.toHaveBeenCalled();
  });

  it("feedback title만 변경 (status 동일) → 메일 hook 미호출", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockTargetSelect.mockResolvedValue({
      data: {
        domain: "feedback",
        author_email: "member@x.com",
        status: "urgent",
      },
      error: null,
    });
    mockUpdate.mockResolvedValue({
      data: {
        id: "x",
        domain: "feedback",
        status: "urgent",
        title: "수정",
        author_email: "member@x.com",
      },
      error: null,
    });
    await updatePost("post-uuid", { title: "수정" });
    expect(mockSendStatusNotify).not.toHaveBeenCalled();
  });

  it("notice status 변경 → 메일 hook 미호출", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockTargetSelect.mockResolvedValue({
      data: { domain: "notice", author_email: "admin@x.com", status: "urgent" },
      error: null,
    });
    mockUpdate.mockResolvedValue({
      data: {
        id: "x",
        domain: "notice",
        status: "approved",
        title: "t",
        author_email: "admin@x.com",
      },
      error: null,
    });
    await updatePost("post-uuid", { status: "approved" });
    expect(mockSendStatusNotify).not.toHaveBeenCalled();
  });

  it("status 변경 + 메일 hook 실패해도 updatePost는 ok 유지", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockTargetSelect.mockResolvedValue({
      data: {
        domain: "feedback",
        author_email: "member@x.com",
        status: "urgent",
      },
      error: null,
    });
    mockUpdate.mockResolvedValue({
      data: {
        id: "x",
        domain: "feedback",
        status: "active",
        title: "t",
        author_email: "member@x.com",
      },
      error: null,
    });
    mockSendStatusNotify.mockRejectedValueOnce(new Error("graph 500"));
    const r = await updatePost("post-uuid", { status: "active" });
    expect(r.ok).toBe(true);
  });
});

describe("createPost — slug 자동 생성 race-safe", () => {
  beforeEach(() => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
  });

  it("기존 글 없음 → FB-001 시도", async () => {
    mockMaxSlug.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({
      data: { id: "x", domain: "feedback", slug: "FB-001" },
      error: null,
    });
    const r = await createPost(validFeedbackInput);
    expect(r.ok).toBe(true);
    expect(mockInsertCall).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "FB-001" }),
    );
  });

  it("기존 max slug FB-005 → 다음 시도는 FB-006 (count 무관)", async () => {
    // 회귀: count=4여도 FB-005 슬러그가 있으면 다음은 FB-006
    mockMaxSlug.mockResolvedValue({
      data: { slug: "FB-005" },
      error: null,
    });
    mockInsert.mockResolvedValue({
      data: { id: "x", domain: "feedback", slug: "FB-006" },
      error: null,
    });
    const r = await createPost(validFeedbackInput);
    expect(r.ok).toBe(true);
    expect(mockInsertCall).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "FB-006" }),
    );
  });

  it("insert 23505 (unique violation) → 다음 번호로 재시도하여 성공", async () => {
    mockMaxSlug.mockResolvedValue({
      data: { slug: "FB-005" },
      error: null,
    });
    mockInsert
      .mockResolvedValueOnce({
        data: null,
        error: { code: "23505", message: "duplicate key" },
      })
      .mockResolvedValueOnce({
        data: { id: "x", domain: "feedback", slug: "FB-007" },
        error: null,
      });
    const r = await createPost(validFeedbackInput);
    expect(r.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(mockInsertCall).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ slug: "FB-006" }),
    );
    expect(mockInsertCall).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ slug: "FB-007" }),
    );
  });

  it("5회 연속 23505 → 실패 메시지 + 5번 시도", async () => {
    mockMaxSlug.mockResolvedValue({
      data: { slug: "FB-005" },
      error: null,
    });
    mockInsert.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    const r = await createPost(validFeedbackInput);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/slug|다시 시도/);
    expect(mockInsert).toHaveBeenCalledTimes(5);
  });

  it("23505 이외 error → 즉시 실패 (재시도 X)", async () => {
    mockMaxSlug.mockResolvedValue({
      data: { slug: "FB-005" },
      error: null,
    });
    mockInsert.mockResolvedValue({
      data: null,
      error: { code: "OTHER", message: "boom" },
    });
    const r = await createPost(validFeedbackInput);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("boom");
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("notice 도메인도 동일 — 기존 max NT-002 → NT-003 시도", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockMaxSlug.mockResolvedValue({
      data: { slug: "NT-002" },
      error: null,
    });
    mockInsert.mockResolvedValue({
      data: { id: "x", domain: "notice", slug: "NT-003" },
      error: null,
    });
    const r = await createPost(validNoticeInput);
    expect(r.ok).toBe(true);
    expect(mockInsertCall).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "NT-003" }),
    );
  });
});
