import { describe, it, expect } from "vitest";
import {
  pickFeatureIntros,
  pickIssueVideo,
} from "../jobs/team-briefing-build";
import { toYouTubeEmbed } from "@/features/briefing/youtube-embed";

/**
 * 7호 — 커버는 유튜브 쇼츠이고 기능 소개는 없다(2026-09-04 요청).
 */
describe("7호", () => {
  it("커버 영상이 있다", () => {
    expect(pickIssueVideo(7)?.src).toContain("1pw7WcjeJ84");
  });

  it("프레임으로 바뀐다 — 링크로 걸면 뉴스레터를 떠나야 본다", () => {
    expect(toYouTubeEmbed(pickIssueVideo(7)!.src)).toBe(
      "https://www.youtube.com/embed/1pw7WcjeJ84",
    );
  });

  it("기능 소개가 없다", () => {
    expect(pickFeatureIntros(7)).toEqual([]);
  });

  it("지난 호는 그대로 — 6호 영상·소개를 건드리지 않는다", () => {
    expect(pickIssueVideo(6)?.src).toContain("qfcx1Dw6L1M");
    expect(pickFeatureIntros(6).map((f) => f.title)).toEqual(["업무 지식망"]);
  });
});
