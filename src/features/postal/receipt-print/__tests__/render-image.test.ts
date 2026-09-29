// @vitest-environment node
//
// sharp 는 node 의 Buffer 를 받는다 — 기본 jsdom 환경에서 돌리지 않는다.
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { renderReceiptImage, SLOT_PX_WIDTH } from "../render-image";
import type { Regions } from "../../extract-parse";

const blank = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#ffffff" } })
    .jpeg()
    .toBuffer();

async function pixel(jpeg: Buffer, x: number, y: number) {
  const { data, info } = await sharp(jpeg)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const i = (Math.round(y) * info.width + Math.round(x)) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

const none: Regions = { receipt: null, accepted_at: null, total_fee: null };

describe("renderReceiptImage", () => {
  it("종이만 잘라 칸 폭(59mm·200dpi)으로 줄인다", async () => {
    const out = await renderReceiptImage(await blank(1000, 2000), {
      ...none,
      receipt: [0.1, 0, 0.9, 1],
    });
    // 잘라낸 영역 840×2000 → 465×1107
    expect([out.widthPx, out.heightPx]).toEqual([SLOT_PX_WIDTH, 1107]);
  });

  it("작은 사진은 키우지 않는다", async () => {
    const out = await renderReceiptImage(await blank(300, 600), null);
    expect([out.widthPx, out.heightPx]).toEqual([300, 600]);
  });

  it("형광펜 자리는 노랗고 그 밖은 희다 — 곱하기라 흰 바탕엔 노랑 그대로", async () => {
    const out = await renderReceiptImage(await blank(1000, 2000), {
      ...none,
      accepted_at: [0.3, 0.1, 0.6, 0.12],
    });
    // 배율 465/1000 — 상자 한가운데 (450, 220)px → (209, 102)
    const inside = await pixel(out.jpeg, 209, 102);
    expect(inside.r).toBeGreaterThan(230);
    expect(inside.b).toBeLessThan(160);
    expect((await pixel(out.jpeg, 20, 20)).b).toBeGreaterThan(240);
  });

  it("위치가 없으면 칠하지 않는다", async () => {
    const out = await renderReceiptImage(await blank(1000, 2000), null);
    expect((await pixel(out.jpeg, 209, 102)).b).toBeGreaterThan(240);
  });

  it("총요금은 한 줄 위까지 칠한다 — 판독이 0~1줄 아래로 짚는다(두 줄 폭)", async () => {
    const out = await renderReceiptImage(await blank(1000, 2000), {
      ...none,
      total_fee: [0.3, 0.5, 0.6, 0.52],
    });
    // 상자 1000~1040px(높이 40) → 한 줄 위 960, 여유 10 → 950~1050. 배율 0.465 → 442~488
    // 452 는 넓힌 칸(원본 972) — 넓히지 않으면 흰색이다.
    expect((await pixel(out.jpeg, 209, 452)).b).toBeLessThan(160);
    expect((await pixel(out.jpeg, 209, 497)).b).toBeGreaterThan(240);
  });

  it("회전 정보가 남은 사진은 위치를 쓰지 않는다 — 판독 좌표가 누운 픽셀 기준이다", async () => {
    const turned = await sharp({
      create: { width: 200, height: 100, channels: 3, background: "#ffffff" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const out = await renderReceiptImage(turned, {
      receipt: [0.5, 0, 1, 1],
      accepted_at: [0.1, 0.1, 0.9, 0.3],
      total_fee: [0.1, 0.6, 0.9, 0.8],
    });
    // 자르지 않고(세운 크기 그대로) 칠하지 않는다.
    expect([out.widthPx, out.heightPx]).toEqual([100, 200]);
    const { channels } = await sharp(out.jpeg).stats();
    expect(channels[2].min).toBeGreaterThan(240);
  });

  it("EXIF 방향을 바로 세운다 — 좌표는 바로 세운 사진 기준이다", async () => {
    const turned = await sharp({
      create: { width: 200, height: 100, channels: 3, background: "#ffffff" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const out = await renderReceiptImage(turned, null);
    expect([out.widthPx, out.heightPx]).toEqual([100, 200]);
  });

  it("읽을 수 없는 사진은 던진다 — 사유는 부르는 쪽이 칸에 적는다", async () => {
    await expect(
      renderReceiptImage(Buffer.from("not an image"), null),
    ).rejects.toThrow();
  });
});
