import type { GraphMailAttachment } from "@/lib/microsoft/sendmail";
import { BRAND_LOGO_PNG_BASE64 } from "./brand-logo-data";

/**
 * 운영부 상황실 브랜드 로고 — 메일 인라인(cid) 임베드.
 *
 * 템플릿 헤더에 `brandLogoImg()`를 넣으면, sendGraphMail이 본문의 cid 참조를
 * 감지해 `brandLogoAttachment()`를 inline 첨부로 자동 주입한다(발송 지점 무변경).
 * Outlook/M365 + 외부 클라이언트 모두 외부이미지 차단 없이 표시된다.
 */
export const BRAND_LOGO_CID = "opslogo";
export const BRAND_LOGO_CONTENT_TYPE = "image/png";

/** sendGraphMail이 본문 cid 감지 시 자동 주입하는 inline 첨부. */
export function brandLogoAttachment(): GraphMailAttachment {
  return {
    name: "ops-logo.png",
    contentType: BRAND_LOGO_CONTENT_TYPE,
    contentBytes: BRAND_LOGO_PNG_BASE64,
    isInline: true,
    contentId: BRAND_LOGO_CID,
  };
}

/** 메일 헤더용 로고 `<img>` — cid 참조. size는 px(정사각). */
export function brandLogoImg(size = 40): string {
  return `<img src="cid:${BRAND_LOGO_CID}" width="${size}" height="${size}" alt="운영부 상황실" style="display:inline-block;border:0;vertical-align:middle;" />`;
}
