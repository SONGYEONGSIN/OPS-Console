import { describe, it, expect } from "vitest";
import { newsRowToListRow } from "../_row-mapper";
import type { NewsRow } from "@/features/news/schemas";

const newsRow: NewsRow = {
  id: "11111111-1111-4111-8111-111111111111",
  link: "https://news.google.com/rss/articles/AAA",
  title: "A대학 B대학 통폐합 추진",
  source: "한국대학신문",
  published_at: "2026-06-16T07:00:00.000Z",
  summary: "A대학과 B대학이 통폐합을 추진한다.",
  keyword: "통폐합",
  collected_at: "2026-06-23T00:00:00.000Z",
};

describe("newsRowToListRow", () => {
  it("news* 필드 매핑 + name=제목 + status=active", () => {
    const row = newsRowToListRow(newsRow);
    expect(row.id).toBe(newsRow.id);
    expect(row.name).toBe("A대학 B대학 통폐합 추진");
    expect(row.status).toBe("active");
    expect(row.newsLink).toBe("https://news.google.com/rss/articles/AAA");
    expect(row.newsSource).toBe("한국대학신문");
    expect(row.newsPublishedAt).toBe("2026-06-16T07:00:00.000Z");
    expect(row.newsSummary).toBe("A대학과 B대학이 통폐합을 추진한다.");
    expect(row.newsKeyword).toBe("통폐합");
  });

  it("nullable 필드 null 시 owner/meta 폴백", () => {
    const row = newsRowToListRow({
      ...newsRow,
      source: null,
      published_at: null,
      summary: null,
      keyword: null,
    });
    expect(row.newsSource).toBeNull();
    expect(row.newsSummary).toBeNull();
    expect(row.name).toBe("A대학 B대학 통폐합 추진");
  });
});
