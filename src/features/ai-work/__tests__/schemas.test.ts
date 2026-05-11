import { describe, it, expect } from "vitest";
import {
  aiToolSchema,
  categorySchema,
  aiWorkRowSchema,
  aiWorkCreateSchema,
  aiWorkUpdateSchema,
} from "../schemas";

describe("aiToolSchema", () => {
  it("허용 enum 7개를 통과시킨다", () => {
    const tools = [
      "claude",
      "chatgpt",
      "gemini",
      "cursor",
      "copilot",
      "notion_ai",
      "etc",
    ];
    for (const t of tools) {
      expect(aiToolSchema.safeParse(t).success).toBe(true);
    }
  });

  it("정의되지 않은 enum은 거부한다", () => {
    expect(aiToolSchema.safeParse("bard").success).toBe(false);
    expect(aiToolSchema.safeParse("").success).toBe(false);
  });
});

describe("categorySchema", () => {
  it("허용 enum 8개를 통과시킨다", () => {
    const cats = [
      "code",
      "doc",
      "analysis",
      "design",
      "translation",
      "meeting",
      "automation",
      "etc",
    ];
    for (const c of cats) {
      expect(categorySchema.safeParse(c).success).toBe(true);
    }
  });

  it("정의되지 않은 enum은 거부한다", () => {
    expect(categorySchema.safeParse("misc").success).toBe(false);
  });
});

const validRow = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "운영 매뉴얼 챕터 5 AI 번역",
  work_date: "2026-05-09",
  ai_tool: "claude",
  category: "translation",
  summary_md: "내부 매뉴얼 번역. 1시간 단축.",
  output_url: "https://notion.so/xxx",
  reuse_prompt: "다음 문장을 자연스러운 한국어로 번역...",
  saved_hours: 1.5,
  tags: ["번역", "매뉴얼"],
  author_email: "ysong2526@gmail.com",
  author_id: "22222222-2222-4222-8222-222222222222",
  created_at: "2026-05-09T00:00:00Z",
  updated_at: "2026-05-09T00:00:00Z",
};

describe("aiWorkRowSchema", () => {
  it("정상 row를 통과시킨다", () => {
    expect(aiWorkRowSchema.safeParse(validRow).success).toBe(true);
  });

  it("선택 필드(output_url / reuse_prompt / saved_hours / author_id)는 null/undefined 허용", () => {
    const minimal = {
      ...validRow,
      output_url: null,
      reuse_prompt: null,
      saved_hours: null,
      author_id: null,
      tags: [],
    };
    expect(aiWorkRowSchema.safeParse(minimal).success).toBe(true);
  });

  it("필수 필드(title / work_date / ai_tool / category / summary_md / author_email) 누락 거부", () => {
    const required = [
      "title",
      "work_date",
      "ai_tool",
      "category",
      "summary_md",
      "author_email",
    ] as const;
    for (const key of required) {
      const broken = { ...validRow, [key]: undefined };
      expect(aiWorkRowSchema.safeParse(broken).success).toBe(false);
    }
  });

  it("ai_tool / category enum 미일치 거부", () => {
    expect(
      aiWorkRowSchema.safeParse({ ...validRow, ai_tool: "bard" }).success,
    ).toBe(false);
    expect(
      aiWorkRowSchema.safeParse({ ...validRow, category: "misc" }).success,
    ).toBe(false);
  });

  it("tags 비배열 거부", () => {
    expect(
      aiWorkRowSchema.safeParse({ ...validRow, tags: "번역,매뉴얼" }).success,
    ).toBe(false);
  });
});

describe("aiWorkCreateSchema", () => {
  const validCreate = {
    title: "회의록 요약 자동화",
    work_date: "2026-05-10",
    ai_tool: "chatgpt",
    category: "meeting",
    summary_md: "주간회의 30분 → 5분으로 요약.",
    tags: ["회의록"],
  };

  it("필수 6필드만 있으면 통과", () => {
    expect(aiWorkCreateSchema.safeParse(validCreate).success).toBe(true);
  });

  it("title 비어있음 거부", () => {
    expect(
      aiWorkCreateSchema.safeParse({ ...validCreate, title: "" }).success,
    ).toBe(false);
  });

  it("title 120자 초과 거부", () => {
    expect(
      aiWorkCreateSchema.safeParse({ ...validCreate, title: "x".repeat(121) })
        .success,
    ).toBe(false);
  });

  it("saved_hours 음수 거부", () => {
    expect(
      aiWorkCreateSchema.safeParse({ ...validCreate, saved_hours: -1 }).success,
    ).toBe(false);
  });

  it("output_url 형식 불량 거부", () => {
    expect(
      aiWorkCreateSchema.safeParse({
        ...validCreate,
        output_url: "not-a-url",
      }).success,
    ).toBe(false);
  });

  it("tags 비배열 거부", () => {
    expect(
      aiWorkCreateSchema.safeParse({
        ...validCreate,
        tags: "번역,매뉴얼" as unknown,
      }).success,
    ).toBe(false);
  });
});

describe("aiWorkUpdateSchema", () => {
  it("모든 필드 optional — 빈 객체 통과", () => {
    expect(aiWorkUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("부분 업데이트 허용", () => {
    expect(
      aiWorkUpdateSchema.safeParse({ saved_hours: 2.5, tags: ["update"] })
        .success,
    ).toBe(true);
  });

  it("enum 미일치는 거부", () => {
    expect(
      aiWorkUpdateSchema.safeParse({ ai_tool: "bard" }).success,
    ).toBe(false);
  });
});
