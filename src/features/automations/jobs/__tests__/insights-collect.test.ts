import { describe, it, expect } from "vitest";
import {
  isAiRelevant,
  filterAiRelevant,
  type CollectedVideo,
} from "../insights-collect";

function vid(over: Partial<CollectedVideo>): CollectedVideo {
  return {
    video_id: "x",
    title: "",
    channel_title: "c",
    thumbnail_url: "t",
    published_at: "2026-01-01",
    description: null,
    keyword: "하네스",
    ...over,
  };
}

describe("isAiRelevant", () => {
  it("제목에 AI 관련어가 있으면 true", () => {
    expect(isAiRelevant(vid({ title: "AI 에이전트 하네스 구축법" }))).toBe(true);
    expect(isAiRelevant(vid({ title: "클로드 코드로 바이브코딩" }))).toBe(true);
    expect(isAiRelevant(vid({ title: "ChatGPT 자동화 꿀팁" }))).toBe(true);
  });

  it("설명에만 AI 관련어가 있어도 true", () => {
    expect(
      isAiRelevant(vid({ title: "개발 일상", description: "Claude로 코딩" })),
    ).toBe(true);
  });

  it("AI 무관 콘텐츠(성인용품/반려동물 하네스 등)는 false", () => {
    expect(isAiRelevant(vid({ title: "강아지 하네스 추천 5종" }))).toBe(false);
    expect(
      isAiRelevant(vid({ title: "성인용품 하네스 리뷰", description: "착용감" })),
    ).toBe(false);
  });

  it("filterAiRelevant — 무관 영상 제외", () => {
    const rows = [
      vid({ video_id: "a", title: "AI 자동화 워크플로우" }),
      vid({ video_id: "b", title: "강아지 하네스 추천" }),
    ];
    expect(filterAiRelevant(rows).map((r) => r.video_id)).toEqual(["a"]);
  });
});
