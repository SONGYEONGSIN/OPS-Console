import { describe, it, expect } from "vitest";
// vitest는 .mjs 상대 import를 타입 에러 없이 지원한다 (story-lib 관례)
import { planAssetUploads } from "../../../../../scripts/team-briefing/upload-assets-lib.mjs";

describe("planAssetUploads", () => {
  it("사진·영상에 번호를 붙이고 파일명을 캡션으로 쓴다", () => {
    const plan = planAssetUploads(
      ["철길마을-달고나 체험.jpg", "단합대회 영상.mp4"],
      [],
    );
    // 파일명 정렬 순 (ㄷ < ㅊ)
    expect(plan).toEqual([
      {
        src: "단합대회 영상.mp4",
        key: "video-01.mp4",
        caption: "단합대회 영상",
        kind: "video",
      },
      {
        src: "철길마을-달고나 체험.jpg",
        key: "photo-01.jpg",
        caption: "철길마을-달고나 체험",
        kind: "image",
      },
    ]);
  });

  it("사진·영상 번호는 서로 독립적으로 매겨진다", () => {
    const plan = planAssetUploads(["a.jpg", "b.mp4", "c.png", "d.mov"], []);
    expect(plan.map((p) => p.key)).toEqual([
      "photo-01.jpg",
      "video-01.mp4",
      "photo-02.jpg",
      "video-02.mov",
    ]);
  });

  it("같은 날 재실행 시 기존 파일 다음 번호로 이어간다", () => {
    const plan = planAssetUploads(
      ["new.jpg"],
      ["photo-01.jpg", "photo-02.jpg", "video-01.mp4", "captions.json"],
    );
    expect(plan[0].key).toBe("photo-03.jpg");
  });

  it("사진은 확장자와 무관하게 .jpg 키로 변환된다 (JPEG 재인코딩)", () => {
    const plan = planAssetUploads(["소주5병.png", "x.webp"], []);
    expect(plan.map((p) => p.key)).toEqual(["photo-01.jpg", "photo-02.jpg"]);
  });

  it("영상은 원본 확장자를 소문자로 유지한다", () => {
    expect(planAssetUploads(["clip.MOV"], [])[0].key).toBe("video-01.mov");
  });

  it("지원하지 않는 확장자는 제외한다", () => {
    expect(
      planAssetUploads(["memo.txt", "captions.json", "a.jpg"], []),
    ).toEqual([
      {
        src: "a.jpg",
        key: "photo-01.jpg",
        caption: "a",
        kind: "image",
      },
    ]);
  });

  it("파일명 순으로 정렬해 번호를 매긴다", () => {
    const plan = planAssetUploads(["c.jpg", "a.jpg", "b.jpg"], []);
    expect(plan.map((p) => p.src)).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
  });
});
