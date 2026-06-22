import { describe, it, expect } from "vitest";
import { newsRowSchema } from "../schemas";

const validRow = {
  id: "11111111-1111-4111-8111-111111111111",
  link: "https://news.google.com/rss/articles/AAA",
  title: "A대학 B대학 통폐합 추진",
  source: "한국대학신문",
  published_at: "2026-06-16T07:00:00.000Z",
  summary: "A대학 B대학 통폐합 추진",
  keyword: "통폐합",
  collected_at: "2026-06-23T00:00:00.000Z",
};

describe("newsRowSchema", () => {
  it("유효 row 통과", () => {
    expect(newsRowSchema.safeParse(validRow).success).toBe(true);
  });
  it("link 누락 시 fail", () => {
    expect(newsRowSchema.safeParse({ ...validRow, link: "" }).success).toBe(
      false,
    );
  });
  it("title 누락 시 fail", () => {
    expect(newsRowSchema.safeParse({ ...validRow, title: "" }).success).toBe(
      false,
    );
  });
  it("nullable 필드(source/published_at/summary/keyword) null 허용", () => {
    expect(
      newsRowSchema.safeParse({
        ...validRow,
        source: null,
        published_at: null,
        summary: null,
        keyword: null,
      }).success,
    ).toBe(true);
  });
});
