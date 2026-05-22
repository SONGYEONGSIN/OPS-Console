import { describe, it, expect } from "vitest";
import { renderDataRequestHtml, escapeHtml, nl2br } from "../mail-template";

describe("escapeHtml", () => {
  it("HTML 특수문자 escape", () => {
    expect(escapeHtml(`<script>"&'`)).toBe(
      "&lt;script&gt;&quot;&amp;&#39;"
    );
  });
});

describe("nl2br", () => {
  it("줄바꿈을 <br>로", () => {
    expect(nl2br("a\nb")).toBe("a<br>b");
  });
});

describe("renderDataRequestHtml", () => {
  const html = renderDataRequestHtml({
    subject: "자료 요청",
    body: "줄1\n<b>굵게</b>",
    universityName: "조선대학교",
    serviceName: "원서접수",
  });

  it("브랜드 문자열 포함", () => {
    expect(html).toContain("운영부 상황실");
  });

  it("본문 escape 후 nl2br (주입 방지)", () => {
    expect(html).toContain("줄1<br>&lt;b&gt;굵게&lt;/b&gt;");
    expect(html).not.toContain("<b>굵게</b>");
  });

  it("대학명/서비스명 노출", () => {
    expect(html).toContain("조선대학교");
    expect(html).toContain("원서접수");
  });
});
