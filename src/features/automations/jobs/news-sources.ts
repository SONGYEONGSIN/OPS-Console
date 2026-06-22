import { XMLParser } from "fast-xml-parser";

/** 수집 소스 정의 — 구글 뉴스 키워드 검색 또는 직접 RSS 피드. */
export type NewsSource =
  | { kind: "google"; keyword: string }
  | { kind: "feed"; keyword: string; url: string; label: string };

/** 구글 뉴스 RSS 키워드 검색 URL. q는 인코딩. */
export function buildGoogleNewsRssUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(
    query,
  )}&hl=ko&gl=KR&ceid=KR:ko`;
}

/**
 * 수집 키워드(스펙 §2) — 운영하며 NEWS_SOURCES 편집으로 조정.
 * 교육부/전문지 직접 피드는 placeholder — 실 URL 동작 확인 후 kind:"feed"로 추가.
 * 구글 뉴스 RSS가 전문지를 이미 집계하므로 직접 피드는 보강 성격(미존재해도 기능 성립).
 */
export const NEWS_SOURCES: NewsSource[] = [
  { kind: "google", keyword: "통폐합" },
  { kind: "google", keyword: "폐교" },
  { kind: "google", keyword: "정원감축" },
  { kind: "google", keyword: "글로컬대학" },
  { kind: "google", keyword: "구조조정" },
  // placeholder — 실 피드 URL 검증 후 활성화 (스펙 §3, §10):
  // { kind: "feed", keyword: "교육부", url: "https://www.moe.go.kr/.../rss", label: "교육부" },
];

export type RssItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
};

export type NewsRow = {
  link: string;
  title: string;
  source: string | null;
  published_at: string | null;
  summary: string | null;
  keyword: string;
};

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

/** RSS XML 문자열 → RssItem[]. 단일 item(객체)·복수 item(배열) 모두 정규화. */
export function parseRssItems(xml: string): RssItem[] {
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  const channel = (doc as { rss?: { channel?: { item?: unknown } } })?.rss
    ?.channel;
  const raw = channel?.item;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map((it) => {
    const o = it as Record<string, unknown>;
    const src = o.source;
    const sourceName =
      typeof src === "object" && src !== null
        ? String((src as Record<string, unknown>)["#text"] ?? "")
        : typeof src === "string"
          ? src
          : "";
    return {
      title: typeof o.title === "string" ? o.title : "",
      link: typeof o.link === "string" ? o.link : "",
      pubDate: typeof o.pubDate === "string" ? o.pubDate : "",
      description: typeof o.description === "string" ? o.description : "",
      source: sourceName,
    };
  });
}

/** RFC2822 pubDate → ISO 문자열. 파싱 불가 시 null. */
export function rfc2822ToIso(pubDate: string): string | null {
  const ms = Date.parse(pubDate);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** HTML 태그 제거 + 기본 엔티티 디코드 + 공백 정리. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** RssItem[] → news row[]. link·title 없는 항목 제외, keyword 주입. */
export function mapRssItemsToNews(items: RssItem[], keyword: string): NewsRow[] {
  return items.flatMap((it) => {
    if (!it.link || !it.title) return [];
    return [
      {
        link: it.link,
        title: it.title,
        source: it.source || null,
        published_at: rfc2822ToIso(it.pubDate),
        summary: it.description ? stripHtml(it.description) || null : null,
        keyword,
      },
    ];
  });
}

/** link 기준 dedupe — 첫 건 유지. */
export function dedupeByLink(rows: NewsRow[]): NewsRow[] {
  const map = new Map<string, NewsRow>();
  for (const r of rows) {
    if (!r.link) continue;
    if (!map.has(r.link)) map.set(r.link, r);
  }
  return Array.from(map.values());
}
