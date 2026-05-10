import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient, mockOrder, mockMaybeSingle } = vi.hoisted(() => {
  const mockOrder = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockCreateClient = vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: mockOrder,
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
  }));
  return { mockCreateClient, mockOrder, mockMaybeSingle };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { listPosts, getPostById } from "../queries";

const validRow = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  domain: "feedback",
  slug: "FB-001",
  title: "테스트",
  body: "본문",
  author_email: "test@example.com",
  author_id: null,
  owner_label: "송영신",
  status: "active",
  created_at: "2026-05-09T00:00:00Z",
  updated_at: "2026-05-09T00:00:00Z",
};

describe("listPosts", () => {
  beforeEach(() => {
    mockOrder.mockReset();
  });

  it("정상 row 반환 + zod parse", async () => {
    mockOrder.mockResolvedValue({ data: [validRow], error: null });
    const posts = await listPosts("feedback");
    expect(posts.length).toBe(1);
    expect(posts[0].title).toBe("테스트");
  });

  it("error → 빈 배열", async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: "boom" } });
    const posts = await listPosts("feedback");
    expect(posts).toEqual([]);
  });

  it("zod fail row는 skip", async () => {
    mockOrder.mockResolvedValue({
      data: [validRow, { ...validRow, status: "BAD" }],
      error: null,
    });
    const posts = await listPosts("feedback");
    expect(posts.length).toBe(1);
  });
});

describe("getPostById", () => {
  beforeEach(() => {
    mockMaybeSingle.mockReset();
  });

  it("정상 row → parse 후 반환", async () => {
    mockMaybeSingle.mockResolvedValue({ data: validRow, error: null });
    const post = await getPostById(validRow.id);
    expect(post?.title).toBe("테스트");
  });

  it("error 또는 null → null 반환", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const post = await getPostById(validRow.id);
    expect(post).toBeNull();
  });
});
