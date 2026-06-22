import { describe, it, expect } from "vitest";
import {
  NEWS_SOURCES,
  buildGoogleNewsRssUrl,
  parseRssItems,
  mapRssItemsToNews,
  dedupeByLink,
  dedupeByTitle,
  rfc2822ToIso,
  stripHtml,
  type RssItem,
} from "../news-sources";

const FIXTURE_XML = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>A대학 B대학 통폐합 추진</title>
    <link>https://news.google.com/rss/articles/AAA?oc=5</link>
    <pubDate>Tue, 16 Jun 2026 07:00:00 GMT</pubDate>
    <description>&lt;a href="x"&gt;A대학 B대학 통폐합 추진&lt;/a&gt;&amp;nbsp;한국대학신문</description>
    <source url="https://news.unn.net">한국대학신문</source>
  </item>
  <item>
    <title>C대학 정원감축 확정</title>
    <link>https://news.google.com/rss/articles/BBB?oc=5</link>
    <pubDate>Mon, 15 Jun 2026 02:30:00 GMT</pubDate>
    <description>본문 스니펫</description>
    <source url="https://kyosu.net">교수신문</source>
  </item>
</channel></rss>`;

describe("NEWS_SOURCES", () => {
  it("키워드 5개 구글 뉴스 소스 포함", () => {
    const keywords = NEWS_SOURCES.filter((s) => s.kind === "google").map(
      (s) => s.keyword,
    );
    expect(keywords).toEqual(
      expect.arrayContaining(["통폐합", "폐교", "정원감축", "글로컬대학", "구조조정"]),
    );
  });
});

describe("buildGoogleNewsRssUrl", () => {
  it("키워드를 인코딩한 구글 뉴스 RSS URL 생성", () => {
    const url = buildGoogleNewsRssUrl("대학 통폐합");
    expect(url).toContain("news.google.com/rss/search");
    expect(url).toContain(encodeURIComponent("대학 통폐합"));
    expect(url).toContain("hl=ko");
    expect(url).toContain("ceid=KR:ko");
  });
});

describe("parseRssItems", () => {
  it("XML 문자열을 RssItem 배열로 파싱 (단일/복수 item 모두)", () => {
    const items = parseRssItems(FIXTURE_XML);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("A대학 B대학 통폐합 추진");
    expect(items[0].source).toBe("한국대학신문");
  });
  it("item 없는 빈 채널은 빈 배열", () => {
    expect(parseRssItems(`<rss><channel></channel></rss>`)).toEqual([]);
  });
});

describe("rfc2822ToIso", () => {
  it("RFC2822 pubDate를 ISO 문자열로 변환", () => {
    expect(rfc2822ToIso("Tue, 16 Jun 2026 07:00:00 GMT")).toBe(
      "2026-06-16T07:00:00.000Z",
    );
  });
  it("파싱 불가 입력은 null", () => {
    expect(rfc2822ToIso("not-a-date")).toBeNull();
  });
});

describe("stripHtml", () => {
  it("HTML 태그와 엔티티 제거 후 트림", () => {
    expect(stripHtml(`<a href="x">제목</a>&nbsp;출처`)).toBe("제목 출처");
  });
});

describe("mapRssItemsToNews", () => {
  it("RssItem[]을 news row로 정규화 + keyword 주입", () => {
    const items = parseRssItems(FIXTURE_XML);
    const rows = mapRssItemsToNews(items, "통폐합");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      link: "https://news.google.com/rss/articles/AAA?oc=5",
      title: "A대학 B대학 통폐합 추진",
      source: "한국대학신문",
      published_at: "2026-06-16T07:00:00.000Z",
      keyword: "통폐합",
    });
  });
  it("link 또는 title 없는 item은 제외", () => {
    const items: RssItem[] = [
      { title: "", link: "https://x", pubDate: "", description: "", source: "" },
      { title: "제목", link: "", pubDate: "", description: "", source: "" },
    ];
    expect(mapRssItemsToNews(items, "폐교")).toHaveLength(0);
  });
});

describe("dedupeByLink", () => {
  it("동일 link 첫 건만 유지", () => {
    const rows = [
      { link: "L1", title: "a", source: null, published_at: null, summary: null, keyword: "통폐합" },
      { link: "L1", title: "b", source: null, published_at: null, summary: null, keyword: "폐교" },
      { link: "L2", title: "c", source: null, published_at: null, summary: null, keyword: "통폐합" },
    ];
    expect(dedupeByLink(rows).map((r) => r.link)).toEqual(["L1", "L2"]);
  });
});

describe("dedupeByTitle", () => {
  it("동일 title 첫 건만 유지 (link 다르더라도)", () => {
    const rows = [
      { link: "L1", title: "통폐합 추진", source: null, published_at: null, summary: null, keyword: "통폐합" },
      { link: "L2", title: "통폐합 추진", source: null, published_at: null, summary: null, keyword: "폐교" },
      { link: "L3", title: "정원감축 확정", source: null, published_at: null, summary: null, keyword: "정원감축" },
    ];
    const out = dedupeByTitle(rows);
    expect(out.map((r) => r.title)).toEqual(["통폐합 추진", "정원감축 확정"]);
    expect(out.map((r) => r.link)).toEqual(["L1", "L3"]);
  });
  it("title 없는 항목은 제외", () => {
    const rows = [
      { link: "L1", title: "", source: null, published_at: null, summary: null, keyword: "통폐합" },
      { link: "L2", title: "정원감축", source: null, published_at: null, summary: null, keyword: "정원감축" },
    ];
    expect(dedupeByTitle(rows).map((r) => r.title)).toEqual(["정원감축"]);
  });
});
