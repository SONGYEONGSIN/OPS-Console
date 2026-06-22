import type { ListRow } from "../_components/patterns/ListPattern";
import type { NewsRow } from "@/features/news/schemas";

/** news row → ListRow (variant="news"). 읽기 전용 — status는 항상 active. */
export function newsRowToListRow(news: NewsRow): ListRow {
  return {
    id: news.id,
    name: news.title,
    status: "active",
    owner: news.source ?? "",
    meta: news.keyword ?? undefined,
    newsLink: news.link,
    newsSource: news.source ?? null,
    newsPublishedAt: news.published_at ?? null,
    newsSummary: news.summary ?? null,
    newsKeyword: news.keyword ?? null,
  };
}
