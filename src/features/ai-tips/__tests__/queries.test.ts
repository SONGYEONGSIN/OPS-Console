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

import { listAiTips } from "../queries";

const validRow = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  title: "회의록 요약 프롬프트",
  ai_tool: "chatgpt",
  category: "meeting",
  summary_md: "주간 회의록 5문장 요약.",
  reuse_prompt: "다음 회의록을 5문장으로 요약해줘.",
  tags: ["회의록"],
  author_email: "ysong2526@gmail.com",
  author_id: null,
  created_at: "2026-05-17T00:00:00Z",
  updated_at: "2026-05-17T00:00:00Z",
};

describe("listAiTips", () => {
  beforeEach(() => {
    mockResult.mockReset();
  });

  it("정상 row 반환 + zod parse", async () => {
    mockResult.mockReturnValue({ data: [validRow], error: null });
    const rows = await listAiTips();
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe("회의록 요약 프롬프트");
  });

  it("필터(authorEmail / aiTool / category) 전달해도 정상 응답", async () => {
    mockResult.mockReturnValue({ data: [validRow], error: null });
    const rows = await listAiTips({
      authorEmail: "ysong2526@gmail.com",
      aiTool: "chatgpt",
      category: "meeting",
    });
    expect(rows.length).toBe(1);
  });

  it("supabase error → 빈 배열", async () => {
    mockResult.mockReturnValue({ data: null, error: { message: "boom" } });
    const rows = await listAiTips();
    expect(rows).toEqual([]);
  });

  it("zod fail row는 skip", async () => {
    mockResult.mockReturnValue({
      data: [validRow, { ...validRow, ai_tool: "bard" }],
      error: null,
    });
    const rows = await listAiTips();
    expect(rows.length).toBe(1);
  });

  it("data null이면 빈 배열", async () => {
    mockResult.mockReturnValue({ data: null, error: null });
    const rows = await listAiTips();
    expect(rows).toEqual([]);
  });
});
