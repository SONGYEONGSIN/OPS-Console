import { describe, it, expect } from "vitest";
import { insightVideoRowSchema, INSIGHT_CHANNELS } from "../schemas";

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

describe("INSIGHT_CHANNELS", () => {
  it("채널 20개", () => {
    expect(INSIGHT_CHANNELS.length).toBe(20);
  });

  it("모든 채널 id는 UC로 시작하고 중복 없음", () => {
    for (const c of INSIGHT_CHANNELS) {
      expect(c.id).toMatch(/^UC/);
      expect(c.name.length).toBeGreaterThan(0);
    }
    const ids = INSIGHT_CHANNELS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Eric Tech는 르완다 채널이 아닌 확정 ID 사용", () => {
    const eric = INSIGHT_CHANNELS.find((c) => c.name === "Eric Tech");
    expect(eric?.id).toBe("UCOXRjenlq9PmlTqd_JhAbMQ");
  });

  it("주요 채널 포함", () => {
    const names = INSIGHT_CHANNELS.map((c) => c.name);
    expect(names).toContain("바이브랩스");
    expect(names).toContain("AgentOS");
    expect(names).toContain("디자인하는AI");
  });
});
