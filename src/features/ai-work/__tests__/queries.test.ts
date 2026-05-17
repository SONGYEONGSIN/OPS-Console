import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient, mockResult } = vi.hoisted(() => {
  const mockResult = vi.fn();
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.order = () => builder;
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

import { listAiWorks } from "../queries";

const validRow = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  title: "회의록 요약 자동화",
  work_start_date: "2026-05-10",
  work_end_date: "2026-05-12",
  ai_tool: "chatgpt",
  category: "meeting",
  summary_md: "주간회의 30분 → 5분.",
  output_url: null,
  reuse_prompt: "회의록을 5문장으로 요약...",
  saved_hours: 0.4,
  tags: ["회의록"],
  author_email: "ysong2526@gmail.com",
  author_id: null,
  created_at: "2026-05-10T00:00:00Z",
  updated_at: "2026-05-10T00:00:00Z",
};

describe("listAiWorks", () => {
  beforeEach(() => {
    mockResult.mockReset();
  });

  it("정상 row 반환 + zod parse", async () => {
    mockResult.mockReturnValue({ data: [validRow], error: null });
    const rows = await listAiWorks();
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe("회의록 요약 자동화");
  });

  it("필터 인자(authorEmail / aiTool / category) 전달해도 정상 응답", async () => {
    mockResult.mockReturnValue({ data: [validRow], error: null });
    const rows = await listAiWorks({
      authorEmail: "ysong2526@gmail.com",
      aiTool: "chatgpt",
      category: "meeting",
    });
    expect(rows.length).toBe(1);
  });

  it("supabase error → 빈 배열", async () => {
    mockResult.mockReturnValue({ data: null, error: { message: "boom" } });
    const rows = await listAiWorks();
    expect(rows).toEqual([]);
  });

  it("zod fail row는 skip", async () => {
    mockResult.mockReturnValue({
      data: [validRow, { ...validRow, ai_tool: "bard" }],
      error: null,
    });
    const rows = await listAiWorks();
    expect(rows.length).toBe(1);
  });

  it("data가 null이면 빈 배열", async () => {
    mockResult.mockReturnValue({ data: null, error: null });
    const rows = await listAiWorks();
    expect(rows).toEqual([]);
  });
});
