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

  it("신규 키워드 AI자동화/CODEX/하네스 포함 (자동화→AI자동화)", () => {
    expect(SEARCH_QUERIES).toContain("AI자동화");
    expect(SEARCH_QUERIES).not.toContain("자동화");
    expect(SEARCH_QUERIES).toContain("CODEX");
    expect(SEARCH_QUERIES).toContain("하네스");
  });
});
