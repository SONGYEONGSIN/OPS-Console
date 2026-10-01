import type { ReceiptTop, Regions } from "./extract-parse";

/**
 * 가로·세로 이동 중 큰 쪽이 작은 쪽의 이만큼은 돼야 방향이라고 본다. 바로 선 운영 영수증
 * 14장은 2.6~7.8배였고, 누운 사진의 흐트러진 상자(#04 옛 판독)는 1.0배였다.
 */
const DOMINANCE = 1.5;

/**
 * 판독 상자로 영수증 맨 위가 사진의 어느 쪽인지 다시 잰다 — 판독의 `receipt_top` 과 **따로**
 * 얻는 두 번째 근거다(스펙 §5.6). 영수증에서 접수일자는 늘 위쪽, 총요금은 그 아래라
 * 접수일자 → 총요금 쪽이 영수증의 '아래'다. 사진 비율이 달라도 같게 재도록 픽셀로 센다.
 *
 * 상자가 없거나 어느 축으로도 뚜렷하지 않으면 null — 모른다.
 */
export function topFromRegions(
  regions: Regions | null,
  width: number,
  height: number,
): ReceiptTop | null {
  const date = regions?.accepted_at;
  const fee = regions?.total_fee;
  if (!date || !fee) return null;

  const dx = ((fee[0] + fee[2] - date[0] - date[2]) / 2) * width;
  const dy = ((fee[1] + fee[3] - date[1] - date[3]) / 2) * height;
  const vertical = Math.abs(dy) >= Math.abs(dx);
  const [major, minor] = vertical ? [dy, dx] : [dx, dy];
  if (Math.abs(major) < DOMINANCE * Math.abs(minor)) return null;

  // 아래가 사진의 아래면 맨 위는 위, 아래가 오른쪽이면 맨 위는 왼쪽이다.
  if (vertical) return dy > 0 ? "top" : "bottom";
  return dx > 0 ? "left" : "right";
}
