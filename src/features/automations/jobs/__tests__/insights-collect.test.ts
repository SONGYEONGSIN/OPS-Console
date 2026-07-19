import { describe, it, expect } from "vitest";
import {
  filterByPublishedAfter,
  mapPlaylistItemsToVideos,
  extractUploadsPlaylists,
  buildCollectRunMessage,
  type CollectedVideo,
} from "../insights-collect";

function vid(over: Partial<CollectedVideo>): CollectedVideo {
  return {
    video_id: "x",
    title: "t",
    channel_title: "c",
    thumbnail_url: "th",
    published_at: "2026-06-01T00:00:00Z",
    description: null,
    keyword: "바이브랩스",
    ...over,
  };
}

describe("filterByPublishedAfter", () => {
  it("cutoff 이후(>=) 영상만 유지", () => {
    const rows = [
      vid({ video_id: "a", published_at: "2026-06-10T00:00:00Z" }),
      vid({ video_id: "b", published_at: "2026-05-01T00:00:00Z" }),
      vid({ video_id: "c", published_at: "2026-05-15T00:00:00Z" }),
    ];
    const out = filterByPublishedAfter(rows, "2026-05-15T00:00:00Z");
    expect(out.map((r) => r.video_id)).toEqual(["a", "c"]);
  });
});

describe("mapPlaylistItemsToVideos", () => {
  it("playlistItems 응답을 CollectedVideo로 변환 + keyword=채널명", () => {
    const json = {
      items: [
        {
          snippet: {
            title: "클로드 코드 입문",
            publishedAt: "2026-06-05T00:00:00Z",
            description: "본문",
            thumbnails: { medium: { url: "https://i/medium.jpg" } },
            resourceId: { videoId: "vid1" },
            videoOwnerChannelTitle: "바이브랩스",
          },
        },
      ],
    };
    const out = mapPlaylistItemsToVideos(json, "바이브랩스");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      video_id: "vid1",
      title: "클로드 코드 입문",
      channel_title: "바이브랩스",
      thumbnail_url: "https://i/medium.jpg",
      published_at: "2026-06-05T00:00:00Z",
      keyword: "바이브랩스",
    });
  });

  it("비공개/삭제/썸네일 없는 영상은 제외", () => {
    const json = {
      items: [
        { snippet: { title: "Private video", resourceId: { videoId: "p1" }, thumbnails: { medium: { url: "x" } } } },
        { snippet: { title: "Deleted video", resourceId: { videoId: "d1" }, thumbnails: { medium: { url: "x" } } } },
        { snippet: { title: "정상", resourceId: { videoId: "ok" } } }, // 썸네일 없음
        { snippet: { title: "노아이디", resourceId: {}, thumbnails: { medium: { url: "x" } } } },
      ],
    };
    expect(mapPlaylistItemsToVideos(json, "데키랩")).toHaveLength(0);
  });
});

describe("buildCollectRunMessage", () => {
  it("신규/갱신/정리를 구분해 표기 (upsert 배치를 '적재'로 뭉뚱그리지 않음)", () => {
    expect(buildCollectRunMessage(4, 6, 16, 0)).toBe(
      "신규 4건 · 갱신 6건 · 정리 16건",
    );
  });

  it("오류가 있으면 접미사로 붙인다", () => {
    expect(buildCollectRunMessage(4, 6, 16, 2)).toBe(
      "신규 4건 · 갱신 6건 · 정리 16건 (2건 오류)",
    );
  });

  it("전부 0이어도 형식 유지", () => {
    expect(buildCollectRunMessage(0, 0, 0, 0)).toBe(
      "신규 0건 · 갱신 0건 · 정리 0건",
    );
  });
});

describe("extractUploadsPlaylists", () => {
  it("channelId → uploads 플레이리스트 매핑", () => {
    const json = {
      items: [
        { id: "C1", contentDetails: { relatedPlaylists: { uploads: "UU1" } } },
        { id: "C2", contentDetails: { relatedPlaylists: { uploads: "UU2" } } },
        { id: "C3", contentDetails: {} }, // uploads 없음 → 제외
      ],
    };
    const m = extractUploadsPlaylists(json);
    expect(m.get("C1")).toBe("UU1");
    expect(m.get("C2")).toBe("UU2");
    expect(m.has("C3")).toBe(false);
  });
});

