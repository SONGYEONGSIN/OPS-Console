import { describe, it, expect } from "vitest";
import {
  batchIds,
  dedupeByVideoId,
  excludeBlocked,
  rankTopN,
  sanitizeText,
  sanitizeVideo,
  type CollectedVideo,
} from "../jobs/insights-collect";

describe("sanitizeText", () => {
  it("NUL·C0 제어문자를 제거 (탭/개행/CR은 유지)", () => {
    expect(sanitizeText("a\u0000b")).toBe("ab");
    expect(sanitizeText("ab")).toBe("ab");
    expect(sanitizeText("a\tb\nc\rd")).toBe("a\tb\nc\rd");
  });

  it("짝 없는 서로게이트를 제거", () => {
    expect(sanitizeText("a\uD800b")).toBe("ab"); // lone high
    expect(sanitizeText("a\uDC00b")).toBe("ab"); // lone low
  });

  it("정상 텍스트·유효 이모지(서로게이트 페어)는 보존", () => {
    expect(sanitizeText("정상 텍스트 abc")).toBe("정상 텍스트 abc");
    expect(sanitizeText("hi 🚀")).toBe("hi 🚀");
  });
});

describe("sanitizeVideo", () => {
  it("문자열 필드를 sanitize하고 null description은 유지", () => {
    const dirty: CollectedVideo = {
      video_id: "x",
      title: "t\u0000",
      channel_title: "c\uD800",
      thumbnail_url: "u",
      published_at: "2026-05-10T00:00:00Z",
      description: "d\u0000",
      keyword: "k",
      view_count: 1,
    };
    const clean = sanitizeVideo(dirty);
    expect(clean.title).toBe("t");
    expect(clean.channel_title).toBe("c");
    expect(clean.description).toBe("d");
    expect(clean.keyword).toBe("k");
    expect(sanitizeVideo({ ...dirty, description: null }).description).toBeNull();
  });
});

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

describe("rankTopN", () => {
  it("view_count 내림차순 상위 N (null은 후순위)", () => {
    const out = rankTopN([v("a", 100), v("b", 300), v("c", undefined), v("d", 200)], 2);
    expect(out.map((r) => r.video_id)).toEqual(["b", "d"]);
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
