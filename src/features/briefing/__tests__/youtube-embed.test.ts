import { describe, it, expect } from "vitest";
import { toYouTubeEmbed } from "../youtube-embed";

/**
 * 유튜브 링크를 **프레임 주소**로 바꾼다.
 *
 * 뉴스레터에 영상을 넣을 때 링크로 걸면 메일을 떠나야 본다. 프레임으로 넣으면
 * 그 자리에서 재생된다. Shorts·watch·youtu.be 는 주소 모양이 다 다르다.
 */
describe("toYouTubeEmbed", () => {
  it("Shorts 주소를 바꾼다", () => {
    expect(toYouTubeEmbed("https://www.youtube.com/shorts/GNSy-p-gp78")).toBe(
      "https://www.youtube.com/embed/GNSy-p-gp78",
    );
  });

  it("일반 watch 주소도 받는다", () => {
    expect(
      toYouTubeEmbed("https://www.youtube.com/watch?v=GNSy-p-gp78"),
    ).toBe("https://www.youtube.com/embed/GNSy-p-gp78");
  });

  it("youtu.be 단축 주소도 받는다", () => {
    expect(toYouTubeEmbed("https://youtu.be/GNSy-p-gp78")).toBe(
      "https://www.youtube.com/embed/GNSy-p-gp78",
    );
  });

  it("쿼리가 붙어도 id만 뽑는다 — 재생목록·시작시각이 섞여 온다", () => {
    expect(
      toYouTubeEmbed("https://www.youtube.com/shorts/GNSy-p-gp78?feature=share"),
    ).toBe("https://www.youtube.com/embed/GNSy-p-gp78");
  });

  it("이미 embed 주소면 그대로 둔다", () => {
    const url = "https://www.youtube.com/embed/GNSy-p-gp78";
    expect(toYouTubeEmbed(url)).toBe(url);
  });

  it("유튜브가 아니면 null — 아무 주소나 프레임에 넣지 않는다", () => {
    expect(toYouTubeEmbed("https://vimeo.com/123")).toBeNull();
    expect(toYouTubeEmbed("https://evil.example.com/embed/x")).toBeNull();
    expect(toYouTubeEmbed("")).toBeNull();
  });

  it("id 모양이 아니면 null — 경로만 보고 믿지 않는다", () => {
    expect(toYouTubeEmbed("https://www.youtube.com/shorts/")).toBeNull();
    expect(toYouTubeEmbed("https://www.youtube.com/shorts/../evil")).toBeNull();
  });
});
