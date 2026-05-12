import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient, mockResult } = vi.hoisted(() => {
  const mockResult = vi.fn();
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(mockResult()).then(onFulfilled);
  const mockCreateClient = vi.fn(async () => ({
    from: () => builder,
  }));
  return { mockCreateClient, mockResult };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { listInsightVideos } from "../queries";

const validRow = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  video_id: "dQw4w9WgXcQ",
  title: "바이브코딩 입문",
  channel_title: "vibe-codes",
  thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
  published_at: "2026-05-10T00:00:00Z",
  view_count: 1234,
  keyword: "바이브코딩",
  description: "처음 200자 요약",
  collected_at: "2026-05-12T00:00:00Z",
};

describe("listInsightVideos", () => {
  beforeEach(() => {
    mockResult.mockReset();
  });

  it("정상 row 반환 + zod parse", async () => {
    mockResult.mockReturnValue({ data: [validRow], error: null });
    const rows = await listInsightVideos();
    expect(rows.length).toBe(1);
    expect(rows[0].video_id).toBe("dQw4w9WgXcQ");
  });

  it("supabase error → 빈 배열", async () => {
    mockResult.mockReturnValue({ data: null, error: { message: "boom" } });
    const rows = await listInsightVideos();
    expect(rows).toEqual([]);
  });

  it("data가 null이면 빈 배열", async () => {
    mockResult.mockReturnValue({ data: null, error: null });
    const rows = await listInsightVideos();
    expect(rows).toEqual([]);
  });

  it("zod fail row는 skip", async () => {
    mockResult.mockReturnValue({
      data: [validRow, { ...validRow, video_id: "" }],
      error: null,
    });
    const rows = await listInsightVideos();
    expect(rows.length).toBe(1);
  });
});
