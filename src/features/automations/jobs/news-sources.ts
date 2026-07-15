import { XMLParser } from "fast-xml-parser";

/** 수집 소스 정의 — 구글 뉴스 키워드 검색 또는 전문지 직접 RSS 피드.
 *  feed는 전체기사 피드라 키워드를 고정하지 않고 기사별로 운영 키워드를 매칭한다. */
export type NewsSource =
  | { kind: "google"; keyword: string }
  | { kind: "feed"; url: string; label: string };

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
  // 전문지 직접 피드 (2026-07-15 URL 동작 검증) — 전체기사 피드이므로
  // mapFeedItemsToNews가 운영 키워드 매칭 기사만 수집한다.
  // 교육부(moe.go.kr) RSS는 서비스 종료 확인 → 스펙 §10에 따라 제외.
  {
    kind: "feed",
    url: "https://news.unn.net/rss/allArticle.xml",
    label: "한국대학신문",
  },
  {
    kind: "feed",
    url: "https://www.kyosu.net/rss/allArticle.xml",
    label: "교수신문",
  },
  {
    kind: "feed",
    url: "https://www.usline.kr/rss/allArticle.xml",
    label: "유스라인",
  },
];

/** 운영 키워드 — 구글 뉴스 소스의 키워드가 단일 소스(피드 매칭에도 재사용). */
export const OPERATIONAL_KEYWORDS: string[] = NEWS_SOURCES.filter(
  (s): s is Extract<NewsSource, { kind: "google" }> => s.kind === "google",
).map((s) => s.keyword);

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

/** pubDate → ISO 문자열. 파싱 불가 시 null.
 *  전문지 CMS(ndsoft) 형식 "YYYY-MM-DD HH:mm:ss"는 타임존이 없어 KST(+09:00)로 해석. */
export function rfc2822ToIso(pubDate: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(pubDate.trim());
  const normalized = m ? `${m[1]}T${m[2]}+09:00` : pubDate;
  const ms = Date.parse(normalized);
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

/**
 * 구글 뉴스 제목 꼬리 ' - 출처' 제거 — 같은 기사가 매체 접미사만 다르게 들어와
 * title dedup을 비껴가는 것을 막고 목록 표시도 깔끔하게 한다.
 * 끝 일치(` - ${source}`)일 때만 제거, 제거 결과가 비면 원본 유지.
 */
export function stripTitleSuffix(title: string, source: string): string {
  const src = source.trim();
  if (!src) return title;
  const suffix = ` - ${src}`;
  let out = title;
  // 실데이터에 이중 접미사("… - 머니투데이 - 머니투데이") 존재 — 반복 제거
  while (out.endsWith(suffix)) {
    const stripped = out.slice(0, -suffix.length);
    if (!stripped.trim()) break;
    out = stripped;
  }
  return out;
}

/** RssItem[] → news row[]. link·title 없는 항목 제외, 접미사 제거 + keyword 주입. */
export function mapRssItemsToNews(items: RssItem[], keyword: string): NewsRow[] {
  return items.flatMap((it) => {
    if (!it.link || !it.title) return [];
    return [
      {
        link: it.link,
        title: stripTitleSuffix(it.title, it.source),
        source: it.source || null,
        published_at: rfc2822ToIso(it.pubDate),
        summary: it.description ? stripHtml(it.description) || null : null,
        keyword,
      },
    ];
  });
}

/**
 * 전문지 전체기사 피드 → news row[]. 제목·요약에 운영 키워드가 매칭되는 기사만
 * 수집(메뉴 목적 유지), 매칭 키워드를 keyword로 부여. <source>가 없으므로 label을 출처로.
 */
export function mapFeedItemsToNews(
  items: RssItem[],
  keywords: readonly string[],
  label: string,
): NewsRow[] {
  return items.flatMap((it) => {
    if (!it.link || !it.title) return [];
    const summary = it.description ? stripHtml(it.description) || null : null;
    const haystack = `${it.title} ${summary ?? ""}`;
    const keyword = keywords.find((k) => haystack.includes(k));
    if (!keyword) return [];
    const source = it.source || label;
    return [
      {
        link: it.link,
        title: stripTitleSuffix(it.title, source),
        source,
        published_at: rfc2822ToIso(it.pubDate),
        summary,
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

/**
 * title 기준 dedupe — 첫 건 유지.
 * 같은 기사가 키워드마다 다른 구글 뉴스 link로 잡히는 문제 해결
 * (link-unique로는 중복 미차단). title이 같으면 동일 기사로 본다.
 */
export function dedupeByTitle(rows: NewsRow[]): NewsRow[] {
  const map = new Map<string, NewsRow>();
  for (const r of rows) {
    if (!r.title) continue;
    if (!map.has(r.title)) map.set(r.title, r);
  }
  return Array.from(map.values());
}
