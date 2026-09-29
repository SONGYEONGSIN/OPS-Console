import type { Box } from "../extract-parse";

/**
 * 영수증 출력의 좌표 변환 — 판독이 준 비율 상자(0~1)를 픽셀로 옮긴다. 순수 함수.
 *
 * 상자는 저장된 사진의 **픽셀** 기준이다 — 판독 모델은 회전 정보(EXIF)를 무시하고 픽셀을 본다
 * (스펙 §4.1). 업로드가 픽셀째 세워 저장하므로(upright-photo.ts) 픽셀 = 바로 선 사진이고,
 * 회전 정보가 남은 옛 사진은 render-image 가 위치를 쓰지 않는다.
 */

/** px 사각형 */
export type Rect = { left: number; top: number; width: number; height: number };
/** 형광펜 한 칸 — 모서리 둥글기 포함 */
export type Mark = Rect & { radius: number };

/** 잘라낼 때 사방 여유 — 사진 폭·높이의 2%. 종이 끝에 딱 맞춰 자르면 가장자리 글자가 잘린다. */
export const CROP_MARGIN = 0.02;
/** 형광펜 여유 — 상자 높이의 25%. 손 형광펜처럼 글자보다 조금 넓게(스파이크 2026-09-28). */
export const MARK_PAD = 0.25;
/**
 * 총요금 형광펜을 위로 넓히는 줄 수(상자 높이 단위). 판독 모델이 총요금 상자를 0~1줄
 * **아래로** 짚는다 — 로컬 평가 6장 중 3장이 바로 아래 '수납요금' 줄, 오차는 전부 아래쪽이고
 * 프롬프트로는 안 고쳐졌다(스펙 §4.1). 한 줄 위까지 칠하면 총요금 줄을 늘 덮는다 — 같은
 * 금액이 적힌 옆 줄이 함께 칠해질 수 있다(사용자 선택 2026-09-29: 두 줄 폭).
 */
export const TOTAL_FEE_LINES_ABOVE = 1;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

/**
 * 잘라낼 영역(px). 종이 상자 + 사방 여유, 사진 밖으로 나가는 부분은 경계에서 자른다.
 * 상자가 없으면 사진 전체.
 */
export function cropRect(box: Box | null, imgW: number, imgH: number): Rect {
  if (!box) return { left: 0, top: 0, width: imgW, height: imgH };
  const [x0, y0, x1, y1] = box;
  // round — floor/ceil 이면 0.8 + 0.02 같은 부동소수 오차(820.0000000000001)에 1px 씩 튄다.
  const left = clamp(Math.round((x0 - CROP_MARGIN) * imgW), 0, imgW);
  const top = clamp(Math.round((y0 - CROP_MARGIN) * imgH), 0, imgH);
  const right = clamp(Math.round((x1 + CROP_MARGIN) * imgW), 0, imgW);
  const bottom = clamp(Math.round((y1 + CROP_MARGIN) * imgH), 0, imgH);
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * 형광펜 자리(출력 px). 원본 비율 상자 → 잘라낸 영역 기준 → 줄인 배율(scale).
 * `linesAbove` 만큼(상자 높이 단위) 위를 더 덮는다 — 총요금은 `TOTAL_FEE_LINES_ABOVE`.
 * 여유는 원래 상자 높이 기준이다.
 *
 * 잘라낸 영역 밖으로 나간 부분은 버리고, 통째로 밖이면 null(칠하지 않는다) —
 * 모델이 종이 상자와 값 상자를 따로 짚어 서로 어긋날 수 있다.
 */
export function markRect(
  box: Box,
  crop: Rect,
  imgW: number,
  imgH: number,
  scale: number,
  linesAbove = 0,
): Mark | null {
  const [x0, y0, x1, y1] = box;
  const lineH = (y1 - y0) * imgH;
  const pad = lineH * MARK_PAD;
  const left = Math.max(x0 * imgW - pad, crop.left);
  const top = Math.max(y0 * imgH - lineH * linesAbove - pad, crop.top);
  const right = Math.min(x1 * imgW + pad, crop.left + crop.width);
  const bottom = Math.min(y1 * imgH + pad, crop.top + crop.height);
  if (right <= left || bottom <= top) return null;
  return {
    left: (left - crop.left) * scale,
    top: (top - crop.top) * scale,
    width: (right - left) * scale,
    height: (bottom - top) * scale,
    radius: pad * scale,
  };
}
