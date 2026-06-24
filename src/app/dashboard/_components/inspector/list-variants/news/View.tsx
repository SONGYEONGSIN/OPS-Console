import { Section, DefList, Divider } from "../shared";
import type { ViewProps } from "../types";

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function NewsView({ row }: ViewProps) {
  return (
    <div className="space-y-6">
      <Section title="기사">
        <DefList
          dense
          items={[
            { term: "제목", desc: row.name || "-" },
            { term: "출처", desc: row.newsSource || "-" },
            {
              term: "게시일",
              desc: <span>{formatDate(row.newsPublishedAt)}</span>,
            },
            { term: "키워드", desc: row.newsKeyword || "-" },
          ]}
        />
      </Section>

      <Divider />

      <Section title="요약">
        <p className="text-sm leading-relaxed text-ink-soft">
          {row.newsSummary || "요약이 없습니다."}
        </p>
      </Section>

      {row.newsLink ? (
        <a
          href={row.newsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block border border-line px-3 py-1.5 text-sm text-ink hover:bg-ink hover:text-cream"
        >
          원문 보기 ↗
        </a>
      ) : null}
    </div>
  );
}
