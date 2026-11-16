import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { ProjectEntryView } from "../merge";

vi.mock("server-only", () => ({}));

const createSignedUrls: Mock = vi.fn();
const storageFrom: Mock = vi.fn(() => ({ createSignedUrls }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ storage: { from: storageFrom } }),
}));

import {
  collectNoteImagePaths,
  fillNoteImageSrc,
  opsWeeklyImagePrefix,
  opsWeeklySignedUrlPrefix,
  signNoteImages,
  signProjectEntries,
  toStoredNoteHtml,
} from "../note-images";

const SP = "https://sb.test/storage/v1/object/sign/ops-weekly/";
const PFX = "2026-11-16/r1/";
const IMG_X = '<img data-ops-path="2026-11-16/r1/x.png" alt="첨부 이미지">';

const pev = (over: Partial<ProjectEntryView>): ProjectEntryView => ({
  projectId: "p1",
  projectName: "프로젝트A",
  kind: "project",
  sortOrder: 1,
  operatorEmail: "a@example.com",
  operatorName: "운영자A",
  stage: null,
  thisWeek: "",
  nextWeek: "",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("경로 접두사", () => {
  it("객체 경로 접두사는 <week_start>/<reportId>/ 다", () => {
    expect(opsWeeklyImagePrefix("2026-11-16", "r1")).toBe("2026-11-16/r1/");
  });
  it("서명 URL 접두사는 이 프로젝트 Supabase 의 ops-weekly sign 경로다", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://sb.test");
    expect(opsWeeklySignedUrlPrefix()).toBe(SP);
    vi.unstubAllEnvs();
  });
});

describe("toStoredNoteHtml", () => {
  it("우리 버킷 서명 URL → data-ops-path(토큰·src 제거, 숫자 width 유지)", () => {
    expect(
      toStoredNoteHtml(
        `<p>a</p><img src="${SP}2026-11-16/r1/x.png?token=abc" width="320">`,
        PFX,
        SP,
      ),
    ).toBe(
      '<p>a</p><img data-ops-path="2026-11-16/r1/x.png" alt="첨부 이미지" width="320">',
    );
  });

  it("남의 보고서 경로는 지운다", () => {
    expect(
      toStoredNoteHtml(
        `<p>a</p><img src="${SP}2026-11-16/r2/x.png?token=abc">`,
        PFX,
        SP,
      ),
    ).toBe("<p>a</p>");
    expect(
      toStoredNoteHtml(
        '<p>a</p><img data-ops-path="2026-11-16/r1/../r2/x.png">',
        PFX,
        SP,
      ),
    ).toBe("<p>a</p>");
  });

  it("외부 src·같은 버킷 public URL·data: 는 지운다", () => {
    expect(
      toStoredNoteHtml('<p>a</p><img src="https://evil/x.png">', PFX, SP),
    ).toBe("<p>a</p>");
    expect(
      toStoredNoteHtml(
        '<p>a</p><img src="https://sb.test/storage/v1/object/public/ops-weekly/2026-11-16/r1/x.png">',
        PFX,
        SP,
      ),
    ).toBe("<p>a</p>");
    expect(
      toStoredNoteHtml(
        '<p>a</p><img src="data:image/png;base64,AAAA">',
        PFX,
        SP,
      ),
    ).toBe("<p>a</p>");
  });

  it("외부 src 에 data-ops-path 를 덧붙여도 src 는 버리고 경로만 남는다", () => {
    expect(
      toStoredNoteHtml(
        '<img src="https://evil/x.png" data-ops-path="2026-11-16/r1/x.png" onerror="alert(1)">',
        PFX,
        SP,
      ),
    ).toBe(IMG_X);
  });

  it("읽기 때 채운 src+data-ops-path 를 다시 저장하면 경로 하나로 돌아온다(왕복)", () => {
    const filled = fillNoteImageSrc(
      IMG_X,
      new Map([["2026-11-16/r1/x.png", `${SP}2026-11-16/r1/x.png?token=t2`]]),
    );
    expect(toStoredNoteHtml(filled, PFX, SP)).toBe(IMG_X);
  });

  it("자리표시자 문자를 써 넣어도 그림이 생기지 않는다", () => {
    expect(toStoredNoteHtml("<p>0</p>", PFX, SP)).toBe("<p>0</p>");
  });

  it("스크립트와 속성은 sanitizeNoteHtml 이 지운다", () => {
    expect(
      toStoredNoteHtml('<p onclick="x">ok</p><script>x</script>', PFX, SP),
    ).toBe("<p>ok</p>");
  });
});

describe("collectNoteImagePaths", () => {
  it("처음 나온 순서로, 중복 없이", () => {
    expect(
      collectNoteImagePaths([
        `${IMG_X}<img data-ops-path="2026-11-16/r1/y.png" alt="첨부 이미지">`,
        IMG_X,
        "<p>none</p>",
      ]),
    ).toEqual(["2026-11-16/r1/x.png", "2026-11-16/r1/y.png"]);
  });
});

describe("fillNoteImageSrc", () => {
  it("경로 → 서명 URL, 없는 경로는 [그림 없음]", () => {
    expect(
      fillNoteImageSrc(
        `${IMG_X}<img data-ops-path="2026-11-16/r1/gone.png" alt="첨부 이미지">`,
        new Map([["2026-11-16/r1/x.png", "https://signed/1"]]),
      ),
    ).toBe(
      '<img src="https://signed/1" data-ops-path="2026-11-16/r1/x.png" alt="첨부 이미지">[그림 없음]',
    );
  });

  it("width 를 유지한다", () => {
    expect(
      fillNoteImageSrc(
        '<img data-ops-path="2026-11-16/r1/x.png" alt="첨부 이미지" width="320">',
        new Map([["2026-11-16/r1/x.png", "https://signed/1"]]),
      ),
    ).toBe(
      '<img src="https://signed/1" data-ops-path="2026-11-16/r1/x.png" alt="첨부 이미지" width="320">',
    );
  });
});

describe("signNoteImages", () => {
  it("createSignedUrls 한 번, 항목 에러는 [그림 없음]", async () => {
    createSignedUrls.mockResolvedValueOnce({
      error: null,
      data: [
        {
          path: "2026-11-16/r1/x.png",
          signedUrl: "https://signed/1",
          error: null,
        },
        {
          path: "2026-11-16/r1/gone.png",
          signedUrl: "",
          error: "Object not found",
        },
      ],
    });
    const out = await signNoteImages([
      IMG_X,
      '<p>b</p><img data-ops-path="2026-11-16/r1/gone.png" alt="첨부 이미지">',
    ]);
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(storageFrom).toHaveBeenCalledWith("ops-weekly");
    expect(createSignedUrls).toHaveBeenCalledWith(
      ["2026-11-16/r1/x.png", "2026-11-16/r1/gone.png"],
      3600,
    );
    expect(out).toEqual([
      '<img src="https://signed/1" data-ops-path="2026-11-16/r1/x.png" alt="첨부 이미지">',
      "<p>b</p>[그림 없음]",
    ]);
  });

  it("그림이 없으면 부르지 않고, 호출 에러는 던진다", async () => {
    expect(await signNoteImages(["<p>a</p>"])).toEqual(["<p>a</p>"]);
    expect(createSignedUrls).not.toHaveBeenCalled();
    createSignedUrls.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });
    await expect(signNoteImages([IMG_X])).rejects.toThrow(
      "[ops-weekly] storage sign: boom",
    );
  });
});

describe("signProjectEntries", () => {
  it("새 배열, 입력은 그대로", async () => {
    createSignedUrls.mockResolvedValueOnce({
      error: null,
      data: [
        {
          path: "2026-11-16/r1/x.png",
          signedUrl: "https://signed/1",
          error: null,
        },
      ],
    });
    const src = [pev({ thisWeek: IMG_X, nextWeek: "<p>n</p>" })];
    const out = await signProjectEntries(src);
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(out).not.toBe(src);
    expect(out[0].thisWeek).toContain('src="https://signed/1"');
    expect(out[0].nextWeek).toBe("<p>n</p>");
    expect(src[0].thisWeek).not.toContain("src=");
  });
});
