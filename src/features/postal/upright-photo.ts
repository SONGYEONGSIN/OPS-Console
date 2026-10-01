import "server-only";
import sharp from "sharp";

/**
 * 폰 사진을 픽셀째 바로 세운다 — 회전 정보(EXIF orientation)가 붙은 JPEG 만.
 *
 * 판독 모델은 회전 정보를 무시하고 저장된 픽셀을 보고 좌표를 준다(스펙 §4.1 — 옆으로 눕힌
 * 사본은 크기와 상관없이 누운 좌표계로 왔고, 총요금 상자도 크게 빗나갔다). 검토 화면·PDF 는
 * 회전 정보대로 세워 보여 주므로, 저장 전에 픽셀을 세워 회전 정보를 없애면 셋이 같은 사진을 본다.
 *
 * 그 밖은 받은 그대로 돌려준다 — 다시 굽지 않는다(화질):
 * - 이미 바로 선 JPEG(회전 정보 없음·1), JPEG 가 아닌 사진
 * - sharp 가 못 읽는 사진(HEIC 등) — 업로드는 막지 않는다. 판독은 되고, 출력은 그 칸에 사유를 적는다
 *
 * 머리는 JPEG 인데 픽셀을 못 푸는 사진은 던진다(바로 선 사진도 끝까지 풀어 본다) — 부르는 쪽이 업로드를 거절한다.
 */
export async function uprightPhoto(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input)
    .metadata()
    .catch(() => null);
  if (!meta || meta.format !== "jpeg") return input;
  if (!meta.orientation || meta.orientation === 1) {
    // 끝까지 풀어 본다(다시 굽지 않는다) — 머리만 멀쩡하고 픽셀이 깨진 JPEG 를 여기서 거른다.
    await sharp(input).stats();
    return input;
  }
  // rotate() 는 회전 정보대로 세운다. 출력에 메타데이터를 싣지 않아 회전 정보가 사라진다.
  return sharp(input).rotate().jpeg({ quality: 92 }).toBuffer();
}
