import "server-only";
import sharp from "sharp";
import type { Regions } from "../extract-parse";
import {
  cropRect,
  markRect,
  TOTAL_FEE_LINES_ABOVE,
  type Mark,
} from "./geometry";

/**
 * 칸 59mm 를 200dpi 로 — 465px. 스파이크(2026-09-28)는 150dpi 에서도 영수증 잔글씨가
 * 읽혔다. 이보다 작은 사진은 키우지 않는다.
 */
export const SLOT_PX_WIDTH = Math.round((59 / 25.4) * 200);

/** 형광펜 노랑. 곱하기 합성이라 글자는 검게 그대로 비친다. */
const HIGHLIGHTER = "#fff176";

export type RenderedImage = { jpeg: Buffer; widthPx: number; heightPx: number };

/**
 * 영수증 사진 → 칸에 넣을 JPEG.
 * 방향 바로잡기 → 종이만 잘라내기 → 인쇄 해상도로 줄이기 → 형광펜.
 *
 * 없는 상자만큼만 빠진다(종이 상자가 없으면 사진 전체, 형광펜 상자가 없으면 그 자리만
 * 안 칠함). 읽을 수 없는 사진(HEIC·손상)은 던진다 — 사유는 부르는 쪽이 칸에 적는다.
 * 총요금은 한 줄 위까지 칠한다(`TOTAL_FEE_LINES_ABOVE`).
 */
export async function renderReceiptImage(
  input: Buffer,
  regions: Regions | null,
): Promise<RenderedImage> {
  const meta = await sharp(input).metadata();
  // autoOrient = EXIF 방향을 반영한 크기. 출력은 세운 사진이라 이걸 쓴다.
  const { width: imgW, height: imgH } = meta.autoOrient;
  // 판독 모델은 회전 정보를 무시하고 저장된 픽셀을 보고 좌표를 준다(스펙 §4.1). 업로드가 사진을
  // 세워 저장하므로(upright-photo.ts) 회전 정보가 남은 사진은 그 전에 올린 것뿐이다 —
  // 좌표계가 달라 위치를 쓰지 않고 세워서 통째로 싣는다.
  const trusted = meta.orientation && meta.orientation !== 1 ? null : regions;
  const crop = cropRect(trusted?.receipt ?? null, imgW, imgH);

  // raw 로 받아 실제 출력 크기를 안다 — 형광펜 층이 그 크기와 정확히 같아야 얹힌다.
  const { data, info } = await sharp(input)
    .rotate()
    .extract(crop)
    .resize({ width: Math.min(crop.width, SLOT_PX_WIDTH) })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const scale = info.width / crop.width;

  const marks = [
    trusted?.accepted_at
      ? markRect(trusted.accepted_at, crop, imgW, imgH, scale)
      : null,
    trusted?.total_fee
      ? markRect(
          trusted.total_fee,
          crop,
          imgW,
          imgH,
          scale,
          TOTAL_FEE_LINES_ABOVE,
        )
      : null,
  ].filter((m): m is Mark => m !== null);

  const base = sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  });
  const painted =
    marks.length === 0
      ? base
      : base.composite([
          {
            input: await markLayer(info.width, info.height, marks),
            blend: "multiply",
          },
        ]);
  const jpeg = await painted.jpeg({ quality: 85 }).toBuffer();
  return { jpeg, widthPx: info.width, heightPx: info.height };
}

/** 흰 바탕에 노랑 사각형 — 곱하기로 얹으면 흰 곳은 그대로, 노랑 곳만 칠해진다. */
async function markLayer(
  width: number,
  height: number,
  marks: Mark[],
): Promise<Buffer> {
  const rects = marks
    .map(
      (m) =>
        `<rect x="${m.left}" y="${m.top}" width="${m.width}" height="${m.height}" rx="${m.radius}" fill="${HIGHLIGHTER}"/>`,
    )
    .join("");
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="#ffffff"/>${rects}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
