import { describe, it, expect } from "vitest";
import {
  NEWS_SOURCES,
  buildGoogleNewsRssUrl,
  parseRssItems,
  mapRssItemsToNews,
  mapFeedItemsToNews,
  dedupeByLink,
  dedupeByTitle,
  rfc2822ToIso,
  stripHtml,
  stripTitleSuffix,
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

  it("전문지 직접 피드 3종 포함 (한국대학신문·교수신문·유스라인)", () => {
    const labels = NEWS_SOURCES.filter((s) => s.kind === "feed").map((s) =>
      s.kind === "feed" ? s.label : "",
    );
    expect(labels).toEqual(
      expect.arrayContaining(["한국대학신문", "교수신문", "유스라인"]),
    );
  });
});

describe("mapFeedItemsToNews", () => {
  const KEYWORDS = ["통폐합", "폐교", "정원감축"];
  const item = (title: string, description = ""): RssItem => ({
    title,
    link: `https://news.unn.net/${title}`,
    pubDate: "2026-07-15 09:00:00",
    description,
    source: "",
  });

  it("운영 키워드가 제목에 있는 기사만 수집 + 매칭 키워드 부여", () => {
    const rows = mapFeedItemsToNews(
      [item("A대·B대 통폐합 추진"), item("총장 인터뷰"), item("C대 폐교 위기")],
      KEYWORDS,
      "한국대학신문",
    );
    expect(rows.map((r) => r.title)).toEqual([
      "A대·B대 통폐합 추진",
      "C대 폐교 위기",
    ]);
    expect(rows.map((r) => r.keyword)).toEqual(["통폐합", "폐교"]);
  });

  it("요약(description)에만 키워드가 있어도 수집", () => {
    const rows = mapFeedItemsToNews(
      [item("교육부 정책 발표", "수도권 대학 정원감축 계획 포함")],
      KEYWORDS,
      "교수신문",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].keyword).toBe("정원감축");
  });

  it("피드는 <source>가 없으므로 label을 출처로", () => {
    const rows = mapFeedItemsToNews([item("D대 통폐합")], KEYWORDS, "유스라인");
    expect(rows[0].source).toBe("유스라인");
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
  it("전문지 CMS 형식('YYYY-MM-DD HH:mm:ss')은 KST(+09:00)로 해석", () => {
    expect(rfc2822ToIso("2026-07-15 09:00:00")).toBe(
      "2026-07-15T00:00:00.000Z",
    );
  });
});

describe("stripHtml", () => {
  it("HTML 태그와 엔티티 제거 후 트림", () => {
    expect(stripHtml(`<a href="x">제목</a>&nbsp;출처`)).toBe("제목 출처");
  });
});

describe("stripTitleSuffix", () => {
  it("제목 끝 ' - 출처' 접미사 제거", () => {
    expect(stripTitleSuffix("A대학 통폐합 추진 - 한국대학신문", "한국대학신문")).toBe(
      "A대학 통폐합 추진",
    );
  });
  it("접미사가 출처와 다르면 그대로", () => {
    expect(stripTitleSuffix("A대학 통폐합 - 다른신문", "한국대학신문")).toBe(
      "A대학 통폐합 - 다른신문",
    );
  });
  it("본문 중간의 ' - 출처'는 건드리지 않음 (끝 일치만)", () => {
    expect(
      stripTitleSuffix("한국대학신문 - 창간 특집 - 한국대학신문", "한국대학신문"),
    ).toBe("한국대학신문 - 창간 특집");
  });
  it("출처가 비어 있으면 그대로", () => {
    expect(stripTitleSuffix("제목 - 어디", "")).toBe("제목 - 어디");
  });
  it("제거 후 빈 문자열이 되면 원본 유지", () => {
    expect(stripTitleSuffix(" - 한국대학신문", "한국대학신문")).toBe(
      " - 한국대학신문",
    );
  });
  it("이중 접미사도 반복 제거 (실데이터 사례: 머니투데이 2중)", () => {
    expect(
      stripTitleSuffix("정원 감축 지원 - 머니투데이 - 머니투데이", "머니투데이"),
    ).toBe("정원 감축 지원");
  });
});

describe("mapRssItemsToNews", () => {
  it("제목의 ' - 출처' 접미사를 제거해 저장 (title dedup 정확도)", () => {
    const items: RssItem[] = [
      {
        title: "A대학 B대학 통폐합 추진 - 한국대학신문",
        link: "https://x/1",
        pubDate: "",
        description: "",
        source: "한국대학신문",
      },
    ];
    expect(mapRssItemsToNews(items, "통폐합")[0].title).toBe(
      "A대학 B대학 통폐합 추진",
    );
  });

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
