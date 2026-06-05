import { describe, it, expect } from "vitest";
import {
  incidentReportMailSubject,
  incidentReportMailBody,
  incidentReportBodyToHtml,
} from "../mail-template";

describe("incident-report mail template", () => {
  it("제목에 진학어플라이 브랜드 + 경위서 전달 건 포함", () => {
    const s = incidentReportMailSubject("전산파일 오류 건");
    expect(s).toBe("[진학어플라이] 전산파일 오류 건 경위서 전달 건");
  });
  it("기본 본문(편집용 텍스트)에 작성자·제목·인사말 포함", () => {
    const body = incidentReportMailBody({
      title: "전산파일 오류 건",
      authorName: "이해영",
    });
    expect(body).toContain("진학어플라이 이해영입니다");
    expect(body).toContain("전산파일 오류 건 관련하여, 경위서 전달드립니다");
    expect(body).toContain("감사합니다");
  });
  it("본문→HTML: 줄바꿈 보존 + HTML escape", () => {
    const html = incidentReportBodyToHtml("줄1\n<b>줄2</b>");
    expect(html).toContain("줄1<br>");
    expect(html).toContain("&lt;b&gt;줄2&lt;/b&gt;");
  });
});
