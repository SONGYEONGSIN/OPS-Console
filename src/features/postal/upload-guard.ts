/**
 * 영수증 업로드 방어 — 저장 순간이 유일한 관문이다.
 *
 * 버킷에 들어간 것은 나중에 서명 URL로 그대로 브라우저에 열린다. 사진이 아닌 것이
 * 섞이면 그 URL이 곧 실행 경로가 된다. 그래서 확장자와 실제 타입을 **둘 다** 본다.
 *
 * 순수 함수로 둔 이유: 라우트 안에 묻으면 우회 시도를 테스트할 수 없다.
 */

/**
 * 저장 버킷. **비공개다** — 공개 URL이 없고 서버가 발급한 서명 URL로만 열린다.
 *
 * `actions.ts`가 아니라 여기 두는 이유: `"use server"` 파일은 async 함수만 export할
 * 수 있어 상수를 내보내면 빌드가 깨진다(타입체크·린트는 못 잡는다).
 */
export const RECEIPT_BUCKET = "postal-receipts";

/** 스마트폰으로 찍은 영수증 한 장. 이보다 크면 사진이 아니거나 잘못 올린 것이다. */
export const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;

/**
 * 받아들이는 형식. **SVG는 뺀다** — 이미지 취급이지만 스크립트를 품을 수 있어
 * 서명 URL로 열면 그대로 실행된다.
 */
const ALLOWED: Record<string, string[]> = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".heic": ["image/heic", "image/heif"],
  ".webp": ["image/webp"],
};

function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i < 0 ? "" : fileName.slice(i).toLowerCase();
}

export function assertUploadable(
  fileName: string,
  mime: string,
  size: number,
): void {
  if (size <= 0) {
    throw new Error("빈 파일입니다");
  }
  if (size > MAX_RECEIPT_BYTES) {
    throw new Error(
      `파일이 너무 큽니다 (최대 ${Math.floor(MAX_RECEIPT_BYTES / 1024 / 1024)}MB)`,
    );
  }
  const ext = extensionOf(fileName);
  const allowedMimes = ALLOWED[ext];
  if (!allowedMimes) {
    throw new Error(`사진 파일만 올릴 수 있습니다: ${fileName}`);
  }
  // 확장자만 바꾼 파일을 막는다 — 둘이 맞아야 통과한다.
  if (!allowedMimes.includes(mime)) {
    throw new Error(`파일 형식이 확장자와 다릅니다: ${mime}`);
  }
}

/**
 * 저장 경로 — 날짜 폴더 + 서버가 만든 id.
 *
 * **원본 파일명을 쓰지 않는다.** 사람이 올리는 이름에는 경로 구분자나 상위 참조가
 * 들어올 수 있고, 한글·공백도 섞인다. 확장자만 가져온다.
 */
export function receiptStoragePath(
  dateFolder: string,
  id: string,
  fileName: string,
): string {
  const ext = extensionOf(fileName);
  if (!ALLOWED[ext]) {
    throw new Error(`저장할 수 없는 형식입니다: ${fileName}`);
  }
  return `${dateFolder}/${id}${ext}`;
}
