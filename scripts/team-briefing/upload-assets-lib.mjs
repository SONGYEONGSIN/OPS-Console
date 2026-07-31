// 뉴스레터 에셋 업로드 계획 — 순수 함수 (fs/네트워크 없음).
// I/O는 upload-assets.mjs가 담당하고, 여기서는 번호 부여/캡션 규칙만 다룬다.

export const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
export const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

/**
 * 업로드할 파일 목록 → Storage 키·캡션 계획.
 *
 * - 사진은 JPEG로 재인코딩하므로 원본 확장자와 무관하게 `photo-NN.jpg`
 * - 영상은 원본 확장자를 소문자로 유지해 `video-NN.ext`
 * - 캡션 = 원본 파일명(확장자 제외)
 * - 같은 날 재실행 시 기존 파일 다음 번호로 이어간다
 *
 * @param {string[]} files 업로드 후보 파일명
 * @param {string[]} existing 해당 날짜 폴더에 이미 있는 파일명
 */
export function planAssetUploads(files, existing = []) {
  let photoIdx = existing.filter((n) => IMAGE_EXT.test(n)).length;
  let videoIdx = existing.filter((n) => VIDEO_EXT.test(n)).length;

  return [...files]
    .filter((f) => IMAGE_EXT.test(f) || VIDEO_EXT.test(f))
    .sort()
    .map((src) => {
      const caption = src.replace(/\.[^.]+$/, "").trim();
      if (IMAGE_EXT.test(src)) {
        photoIdx += 1;
        return {
          src,
          key: `photo-${String(photoIdx).padStart(2, "0")}.jpg`,
          caption,
          kind: "image",
        };
      }
      videoIdx += 1;
      const ext = src.slice(src.lastIndexOf(".")).toLowerCase();
      return {
        src,
        key: `video-${String(videoIdx).padStart(2, "0")}${ext}`,
        caption,
        kind: "video",
      };
    });
}
