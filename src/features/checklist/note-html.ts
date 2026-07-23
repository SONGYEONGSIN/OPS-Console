import sanitizeHtml from "sanitize-html";

// 메모(note)는 작성폼 리치에디터의 HTML을 저장한다. 공개 토큰으로 누구나 쓸 수 있으므로
// 서버에서 반드시 sanitize 후 저장한다(관리자/보고 화면에서 렌더 → XSS 방어).
// 허용: 텍스트·줄바꿈·간단 서식 + 우리 Supabase 스토리지(checklist 버킷)에 업로드된 이미지만.

function defaultStoragePrefix(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/checklist/`;
}

/** 공개 입력 note HTML을 안전한 HTML로 정화한다. img는 우리 스토리지 URL만 유지. */
export function sanitizeNoteHtml(
  html: string,
  storagePrefix: string = defaultStoragePrefix(),
): string {
  return sanitizeHtml(html, {
    allowedTags: ["br", "div", "p", "b", "i", "u", "img"],
    allowedAttributes: { img: ["src", "alt"] },
    allowedSchemes: ["https"],
    transformTags: {
      img: (_tagName, attribs): sanitizeHtml.Tag => {
        const src = attribs.src ?? "";
        if (storagePrefix && src.startsWith(storagePrefix)) {
          return { tagName: "img", attribs: { src, alt: "첨부 이미지" } };
        }
        // 외부/위험 이미지는 제거
        return { tagName: "span", attribs: {} };
      },
    },
  });
}

/** PDF·텍스트 표시용 — 태그 제거하되 블록/줄바꿈은 개행으로 보존. */
export function stripNoteHtml(html: string): string {
  const withBreaks = html
    .replace(/<\/(p|div)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  return sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** note HTML 안의 이미지 URL 목록 추출 (PDF 이미지 렌더용). */
export function extractNoteImages(html: string): string[] {
  return Array.from(html.matchAll(/<img[^>]+src="([^"]+)"/gi)).map((m) => m[1]);
}
