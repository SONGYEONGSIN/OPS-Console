import { describe, it, expect } from "vitest";
import { pickFeatureIntros, pickIssueVideo } from "../jobs/team-briefing-build";
import { toYouTubeEmbed } from "@/features/briefing/youtube-embed";

/**
 * 6호 — 바나나킥 아기 영상 + 업무 지식망 소개(2026-08-28 요청).
 */
describe("6호", () => {
  it("영상이 프레임으로 뜬다", () => {
    const v = pickIssueVideo(6);
    expect(v).toBeDefined();
    expect(toYouTubeEmbed(v!.src)).toBe("https://www.youtube.com/embed/qfcx1Dw6L1M");
  });

  it("기능 소개는 업무 지식망 하나다", () => {
    expect(pickFeatureIntros(6).map((f) => f.title)).toEqual(["업무 지식망"]);
  });

  it("네 탭을 다 설명한다 — '자세히'가 요청이었다", () => {
    const d = pickFeatureIntros(6)[0].desc;
    for (const tab of ["문서", "초안 만들기", "검토 대기", "빈틈"]) {
      expect(d, tab).toContain(tab);
    }
  });

  it("왜 검토가 필요한지 적는다 — 버튼 이름만으로는 안 누른다", () => {
    expect(pickFeatureIntros(6)[0].desc).toMatch(/근거|잘못된/);
  });

  it("5호 영상은 그대로 — 지난 호를 건드리지 않는다", () => {
    expect(pickIssueVideo(5)?.src).toContain("GNSy-p-gp78");
  });
});
