// @vitest-environment node
//
// sharp 는 node 의 Buffer 를 받는다 — 기본 jsdom 환경에서 돌리지 않는다.
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { uprightPhoto } from "../upright-photo";

/** 왼쪽 절반이 검정인 200×100 JPEG. orientation 을 주면 그 회전 정보를 붙인다. */
async function halfBlack(orientation?: number) {
  const img = sharp({
    create: { width: 200, height: 100, channels: 3, background: "#ffffff" },
  })
    .composite([
      {
        input: {
          create: {
            width: 100,
            height: 100,
            channels: 3,
            background: "#000000",
          },
        },
        left: 0,
        top: 0,
      },
    ])
    .jpeg();
  return (orientation ? img.withMetadata({ orientation }) : img).toBuffer();
}

/** (x, y) 의 밝기 — 첫 채널 */
async function luma(jpeg: Buffer, x: number, y: number) {
  const { data, info } = await sharp(jpeg)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data[(y * info.width + x) * info.channels];
}

describe("uprightPhoto", () => {
  it("회전 정보가 있는 JPEG 는 픽셀째 세우고 회전 정보를 없앤다", async () => {
    const out = await uprightPhoto(await halfBlack(6));
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([100, 200]);
    expect(meta.orientation ?? 1).toBe(1);
  });

  it("보이던 모습 그대로 선다 — 방향 6 은 왼쪽이 위로 간다", async () => {
    const out = await uprightPhoto(await halfBlack(6));
    expect(await luma(out, 50, 40)).toBeLessThan(60);
    expect(await luma(out, 50, 160)).toBeGreaterThan(200);
  });

  it("이미 바로 선 JPEG 는 다시 굽지 않는다 — 받은 그대로", async () => {
    const plain = await halfBlack();
    expect(await uprightPhoto(plain)).toBe(plain);
    const one = await halfBlack(1);
    expect(await uprightPhoto(one)).toBe(one);
  });

  it("JPEG 가 아니면 그대로 — PNG", async () => {
    const png = await sharp({
      create: { width: 20, height: 10, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    expect(await uprightPhoto(png)).toBe(png);
  });

  it("sharp 가 못 읽는 사진(HEIC 등)은 그대로 — 업로드를 막지 않는다", async () => {
    const unreadable = Buffer.from("not an image");
    expect(await uprightPhoto(unreadable)).toBe(unreadable);
  });

  it("머리는 JPEG 인데 픽셀이 잘렸으면 던진다 — 바로 선 사진도", async () => {
    // 잡음 400×400 은 앞부분(머리)이 온전한 채 뒤가 잘린다 — 작은 단색 JPEG 는 머리까지 잘린다.
    const W = 400;
    const raw = Buffer.alloc(W * W * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 7919) % 251;
    const jpeg = await sharp(raw, { raw: { width: W, height: W, channels: 3 } })
      .jpeg({ quality: 90 })
      .toBuffer();
    const cut = jpeg.subarray(0, Math.floor(jpeg.length * 0.6));
    expect((await sharp(cut).metadata()).format).toBe("jpeg");
    await expect(uprightPhoto(cut)).rejects.toThrow();
  });
});
