import { describe, it, expect } from "vitest";
import {
  BRAND_LOGO_CID,
  brandLogoAttachment,
  brandLogoImg,
} from "../brand-logo";
import { BRAND_LOGO_PNG_BASE64 } from "../brand-logo-data";

describe("brandLogoImg", () => {
  it("cid 참조 img + alt + 크기 포함", () => {
    const html = brandLogoImg(44);
    expect(html).toContain(`src="cid:${BRAND_LOGO_CID}"`);
    expect(html).toContain('alt="운영부 상황실"');
    expect(html).toContain('width="44"');
    expect(html).toContain('height="44"');
  });

  it("기본 크기 적용", () => {
    expect(brandLogoImg()).toMatch(/width="\d+"/);
  });
});

describe("brandLogoAttachment", () => {
  it("inline 첨부 메타 — isInline + contentId + png base64", () => {
    const a = brandLogoAttachment();
    expect(a.isInline).toBe(true);
    expect(a.contentId).toBe(BRAND_LOGO_CID);
    expect(a.contentType).toBe("image/png");
    expect(a.contentBytes).toBe(BRAND_LOGO_PNG_BASE64);
    expect(a.name).toMatch(/\.png$/);
  });
});
