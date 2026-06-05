import { describe, it, expect } from "vitest";
import {
  incidentReportMailSubject,
  incidentReportMailBody,
  incidentReportBodyToHtml,
} from "../mail-template";

describe("incident-report mail template", () => {
  it("제목에 운영부 상황실 브랜드 + 경위서 제목 포함", () => {
    const s = incidentReportMailSubject("전산파일 오류 건");
    expect(s).toContain("운영부 상황실");
    expect(s).toContain("전산파일 오류 건");
  });
  it("기본 본문(편집용 텍스트)에 대학명/제목/작성자 포함", () => {
    const body = incidentReportMailBody({
      university: "건국대학교",
      title: "전산파일 오류 건",
      authorName: "이해영",
    });
    expect(body).toContain("건국대학교");
    expect(body).toContain("전산파일 오류 건");
    expect(body).toContain("이해영");
  });
  it("본문→HTML: 줄바꿈 보존 + HTML escape", () => {
    const html = incidentReportBodyToHtml("줄1\n<b>줄2</b>");
    expect(html).toContain("줄1<br>");
    expect(html).toContain("&lt;b&gt;줄2&lt;/b&gt;");
  });
});
