import { describe, it, expect } from "vitest";
import {
  renderDataRequestHtml,
  escapeHtml,
  nl2br,
  buildDefaultDataRequestText,
} from "../mail-template";

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
  });

  it("자동발송 푸터 포함", () => {
    expect(html).toContain("시스템에서 자동 발송");
  });

  it("본문 escape 후 nl2br (주입 방지)", () => {
    expect(html).toContain("줄1<br>&lt;b&gt;굵게&lt;/b&gt;");
    expect(html).not.toContain("<b>굵게</b>");
  });
});

describe("buildDefaultDataRequestText", () => {
  it("제목에 브랜드 + 대학명 + 서비스명 포함, 본문에 인사·요청항목·일정 포함", () => {
    const { subject, body } = buildDefaultDataRequestText({
      operatorName: "송영신",
      universityName: "조선대학교",
      serviceName: "수시모집",
      writeStart: "2025.05.11",
      writeEnd: "2025.06.02",
    });
    expect(subject).toContain("[진학어플라이]");
    expect(subject).toContain("조선대학교");
    expect(subject).toContain("수시모집");
    expect(body).toContain("진학어플라이 송영신입니다");
    expect(body).toContain("요청 항목");
    expect(body).toContain("모집요강");
    expect(body).toContain("(작년 일정 : 2025.05.11 ~ 2025.06.02)");
  });

  it("일정이 비어있으면 작년 일정 라인 생략", () => {
    const { body } = buildDefaultDataRequestText({
      operatorName: "송영신",
      universityName: "조선대학교",
      serviceName: "수시모집",
      writeStart: "",
      writeEnd: "",
    });
    expect(body).not.toContain("작년 일정");
  });
});
