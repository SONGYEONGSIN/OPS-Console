import { describe, it, expect } from "vitest";
import {
  batchIds,
  buildSearchParams,
  dedupeByVideoId,
  excludeBlocked,
  filterKoreanTitles,
  filterPopular,
  hasKorean,
  rankTopN,
  type CollectedVideo,
} from "../jobs/insights-collect";

function v(id: string, view?: number): CollectedVideo {
  return {
    video_id: id,
    title: "t",
    channel_title: "c",
    thumbnail_url: "u",
    published_at: "2026-05-10T00:00:00Z",
    description: null,
    keyword: "k",
    view_count: view,
  };
}

describe("batchIds", () => {
  it("50개 초과를 50씩 분할", () => {
    const ids = Array.from({ length: 120 }, (_, i) => `id${i}`);
    const out = batchIds(ids, 50);
    expect(out.map((b) => b.length)).toEqual([50, 50, 20]);
  });
  it("빈 배열은 빈 결과", () => {
    expect(batchIds([], 50)).toEqual([]);
  });
});

describe("dedupeByVideoId", () => {
  it("같은 video_id는 첫 항목만 유지", () => {
    const out = dedupeByVideoId([v("a", 1), v("a", 2), v("b", 3)]);
    expect(out.map((r) => r.video_id)).toEqual(["a", "b"]);
    expect(out[0].view_count).toBe(1);
  });
});

describe("filterPopular", () => {
  it("임계값 미만 제외, null view_count는 통과", () => {
    const out = filterPopular([v("a", 5000), v("b", 20000), v("c", undefined)], 10000);
    expect(out.map((r) => r.video_id)).toEqual(["b", "c"]);
  });
});

describe("rankTopN", () => {
  it("view_count 내림차순 상위 N (null은 후순위)", () => {
    const out = rankTopN([v("a", 100), v("b", 300), v("c", undefined), v("d", 200)], 2);
    expect(out.map((r) => r.video_id)).toEqual(["b", "d"]);
  });
});

describe("buildSearchParams", () => {
  it("국내 우선 — regionCode=KR + relevanceLanguage=ko 포함", () => {
    const p = buildSearchParams("바이브코딩", "2026-05-01T00:00:00Z", "KEY");
    expect(p.get("regionCode")).toBe("KR");
    expect(p.get("relevanceLanguage")).toBe("ko");
  });

  it("q / order / publishedAfter / key 전달", () => {
    const p = buildSearchParams("AI자동화", "2026-05-01T00:00:00Z", "KEY");
    expect(p.get("q")).toBe("AI자동화");
    expect(p.get("order")).toBe("viewCount");
    expect(p.get("publishedAfter")).toBe("2026-05-01T00:00:00Z");
    expect(p.get("key")).toBe("KEY");
  });
});

describe("hasKorean", () => {
  it("한글이 있으면 true", () => {
    expect(hasKorean("바이브코딩 입문")).toBe(true);
    expect(hasKorean("AI 자동화 가이드")).toBe(true);
  });
  it("한글이 없으면 false", () => {
    expect(hasKorean("Next Level 3D Print Automation")).toBe(false);
    expect(hasKorean("CODEX vs Claude Code")).toBe(false);
    expect(hasKorean("")).toBe(false);
  });
});

describe("filterKoreanTitles", () => {
  it("제목에 한글이 없는 영상을 제외", () => {
    const vt = (id: string, title: string): CollectedVideo => ({
      video_id: id,
      title,
      channel_title: "c",
      thumbnail_url: "u",
      published_at: "2026-05-10T00:00:00Z",
      description: null,
      keyword: "k",
    });
    const out = filterKoreanTitles([
      vt("a", "바이브코딩 완전정복"),
      vt("b", "Next Level 3D Print"),
      vt("c", "클로드 스킬 활용법"),
    ]);
    expect(out.map((r) => r.video_id)).toEqual(["a", "c"]);
  });
});

describe("excludeBlocked", () => {
  it("blocklist에 있는 video_id를 제외", () => {
    const out = excludeBlocked(
      [v("a"), v("b"), v("c")],
      new Set(["b"]),
    );
    expect(out.map((r) => r.video_id)).toEqual(["a", "c"]);
  });

  it("빈 blocklist면 그대로 통과", () => {
    const out = excludeBlocked([v("a"), v("b")], new Set());
    expect(out.map((r) => r.video_id)).toEqual(["a", "b"]);
  });
});
