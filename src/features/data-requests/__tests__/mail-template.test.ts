import { describe, it, expect } from "vitest";
import { buildDataRequestMail, escapeHtml } from "../mail-template";

describe("escapeHtml", () => {
  it("HTML 특수문자 escape", () => {
    expect(escapeHtml(`<script>"&'`)).toBe(
      "&lt;script&gt;&quot;&amp;&#39;"
    );
  });
});

describe("buildDataRequestMail", () => {
  it("제목에 브랜드 + 대학명 + 서비스명 포함, 본문에 인사·요청항목·일정 포함", () => {
    const { subject, html } = buildDataRequestMail({
      operatorName: "송영신",
      universityName: "조선대학교",
      serviceName: "수시모집",
      writeStart: "2025.05.11",
      writeEnd: "2025.06.02",
    });
    expect(subject).toContain("[진학어플라이]");
    expect(subject).toContain("조선대학교");
    expect(subject).toContain("수시모집");
    expect(html).toContain("진학어플라이 송영신입니다");
    expect(html).toContain("요청 항목");
    expect(html).toContain("모집요강");
    expect(html).toContain("<strong>(작년 일정 : 2025.05.11 ~ 2025.06.02)</strong>");
  });

  it("일정이 비어있으면 작년 일정 라인 생략", () => {
    const { html } = buildDataRequestMail({
      operatorName: "송영신",
      universityName: "조선대학교",
      serviceName: "수시모집",
      writeStart: "",
      writeEnd: "",
    });
    expect(html).not.toContain("작년 일정");
  });

  it("변수의 HTML 특수문자는 escape되어 주입 방지", () => {
    const { html } = buildDataRequestMail({
      operatorName: "송영신",
      universityName: "A<b>",
      serviceName: "수시모집",
      writeStart: "",
      writeEnd: "",
    });
    expect(html).toContain("A&lt;b&gt;");
    expect(html).not.toContain("A<b>");
  });
});
