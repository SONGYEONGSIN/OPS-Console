import { describe, it, expect } from "vitest";
import { insightVideoRowSchema, SEARCH_QUERIES } from "../schemas";

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

describe("insightVideoRowSchema", () => {
  it("정상 row 파싱 성공", () => {
    const r = insightVideoRowSchema.safeParse(validRow);
    expect(r.success).toBe(true);
  });

  it("video_id 누락 거부", () => {
    const { video_id: _ignored, ...rest } = validRow;
    void _ignored;
    const r = insightVideoRowSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  it("view_count / description / collected_at 외 optional 필드는 nullable 허용", () => {
    const r = insightVideoRowSchema.safeParse({
      ...validRow,
      view_count: null,
      description: null,
    });
    expect(r.success).toBe(true);
  });
});

describe("SEARCH_QUERIES", () => {
  it("길이는 10", () => {
    expect(SEARCH_QUERIES.length).toBe(10);
  });

  it("바이브코딩 키워드 포함", () => {
    expect(SEARCH_QUERIES).toContain("바이브코딩");
  });

  it("AI 맥락 키워드 — 모호어 제거(하네스/CODEX) 후 명확화", () => {
    expect(SEARCH_QUERIES).toContain("AI 업무 자동화");
    expect(SEARCH_QUERIES).not.toContain("자동화");
    expect(SEARCH_QUERIES).not.toContain("AI자동화");
    // 모호한 단독 검색어 제거 → AI 맥락 키워드로 대체
    expect(SEARCH_QUERIES).not.toContain("하네스");
    expect(SEARCH_QUERIES).not.toContain("CODEX");
    expect(SEARCH_QUERIES).toContain("OpenAI Codex");
    expect(SEARCH_QUERIES).toContain("AI 코딩 에이전트");
  });
});
