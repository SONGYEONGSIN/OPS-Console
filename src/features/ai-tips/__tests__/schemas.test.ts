import { describe, it, expect } from "vitest";
import {
  aiTipRowSchema,
  aiTipCreateSchema,
  aiTipUpdateSchema,
} from "../schemas";

const validRow = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "회의록 5문장 요약 프롬프트",
  ai_tool: "chatgpt",
  category: "meeting",
  summary_md: "주간 회의록을 5문장 이내로 압축. 결정 사항 + 액션 아이템 분리.",
  reuse_prompt:
    "다음 회의록을 5문장 이내로 요약하되, 결정 사항과 액션 아이템을 별도 섹션으로 정리해줘.",
  tags: ["회의록", "주간"],
  author_email: "ysong2526@gmail.com",
  author_id: null,
  created_at: "2026-05-17T00:00:00Z",
  updated_at: "2026-05-17T00:00:00Z",
};

describe("aiTipRowSchema", () => {
  it("정상 row 통과", () => {
    expect(aiTipRowSchema.safeParse(validRow).success).toBe(true);
  });

  it("필수 필드(title / ai_tool / category / summary_md / reuse_prompt / author_email) 누락 거부", () => {
    const required = [
      "title",
      "ai_tool",
      "category",
      "summary_md",
      "reuse_prompt",
      "author_email",
    ] as const;
    for (const key of required) {
      const broken = { ...validRow, [key]: undefined };
      expect(aiTipRowSchema.safeParse(broken).success).toBe(false);
    }
  });

  it("ai_tool / category enum 미일치 거부", () => {
    expect(aiTipRowSchema.safeParse({ ...validRow, ai_tool: "bard" }).success).toBe(false);
    expect(aiTipRowSchema.safeParse({ ...validRow, category: "misc" }).success).toBe(false);
  });

  it("title 80자 초과 거부", () => {
    expect(
      aiTipRowSchema.safeParse({ ...validRow, title: "x".repeat(81) }).success,
    ).toBe(false);
  });

  it("summary_md 500자 초과 거부", () => {
    expect(
      aiTipRowSchema.safeParse({ ...validRow, summary_md: "x".repeat(501) }).success,
    ).toBe(false);
  });

  it("reuse_prompt 빈 문자열 거부 (NOT NULL + min 1)", () => {
    expect(
      aiTipRowSchema.safeParse({ ...validRow, reuse_prompt: "" }).success,
    ).toBe(false);
  });
});

describe("aiTipCreateSchema", () => {
  const validCreate = {
    title: "회의록 요약 프롬프트",
    ai_tool: "chatgpt" as const,
    category: "meeting" as const,
    summary_md: "주간 회의록을 5문장으로 요약.",
    reuse_prompt: "다음 회의록을 5문장으로 요약해줘.",
    tags: ["회의록"],
  };

  it("필수 5필드 + tags로 통과", () => {
    expect(aiTipCreateSchema.safeParse(validCreate).success).toBe(true);
  });

  it("title 빈 — 거부", () => {
    expect(
      aiTipCreateSchema.safeParse({ ...validCreate, title: "" }).success,
    ).toBe(false);
  });

  it("title 80자 초과 — 거부", () => {
    expect(
      aiTipCreateSchema.safeParse({ ...validCreate, title: "x".repeat(81) }).success,
    ).toBe(false);
  });

  it("reuse_prompt 누락 — 거부 (TIP 핵심)", () => {
    const { reuse_prompt: _omit, ...rest } = validCreate;
    expect(aiTipCreateSchema.safeParse(rest).success).toBe(false);
  });

  it("tags 미지정 — 빈 배열로 default", () => {
    const { tags: _omit, ...rest } = validCreate;
    const parsed = aiTipCreateSchema.safeParse(rest);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.tags).toEqual([]);
  });
});

describe("aiTipUpdateSchema", () => {
  it("모든 필드 optional — 빈 객체 통과", () => {
    expect(aiTipUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("부분 업데이트 (tags만)", () => {
    expect(aiTipUpdateSchema.safeParse({ tags: ["new"] }).success).toBe(true);
  });

  it("enum 미일치 거부", () => {
    expect(
      aiTipUpdateSchema.safeParse({ ai_tool: "bard" }).success,
    ).toBe(false);
  });
});
