import { describe, it, expect } from "vitest";
import { pickIssueVideo } from "../jobs/team-briefing-build";
import { toYouTubeEmbed } from "@/features/briefing/youtube-embed";

/**
 * 호수별 영상 지정.
 *
 * 사진이 없는 주에 커버 자리가 비었다. 영상은 매주 바뀌므로 기능 소개 핀과 같은
 * 방식으로 호수에 매단다 — 코드에서 어느 호에 무엇을 실었는지 사람이 읽을 수 있다.
 */
describe("pickIssueVideo", () => {
  it("5호에 영상이 있다", () => {
    const v = pickIssueVideo(5);
    expect(v).toBeDefined();
    expect(toYouTubeEmbed(v!.src)).not.toBeNull();
  });

  it("멘트가 붙어 있다 — 무엇을 보게 될지 알려주는 자리다", () => {
    expect(pickIssueVideo(5)?.caption?.length ?? 0).toBeGreaterThan(0);
  });

  it("지정 안 한 호는 없음 — 지난 영상을 다시 틀지 않는다", () => {
    expect(pickIssueVideo(4)).toBeUndefined();
    expect(pickIssueVideo(99)).toBeUndefined();
  });

  it("유튜브 주소만 담는다 — 다른 곳은 프레임에 안 뜬다", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const v = pickIssueVideo(n);
      if (v) expect(toYouTubeEmbed(v.src), `${n}호`).not.toBeNull();
    }
  });
});
