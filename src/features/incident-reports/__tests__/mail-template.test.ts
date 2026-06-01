import { describe, it, expect } from "vitest";
import { incidentReportMailHtml, incidentReportMailSubject } from "../mail-template";

describe("incident-report mail template", () => {
  it("제목에 운영부 상황실 브랜드 + 경위서 제목 포함", () => {
    const s = incidentReportMailSubject("전산파일 오류 건");
    expect(s).toContain("운영부 상황실");
    expect(s).toContain("전산파일 오류 건");
  });
  it("본문에 대학명/제목/작성자 포함", () => {
    const html = incidentReportMailHtml({ university: "건국대학교", title: "전산파일 오류 건", authorName: "이해영" });
    expect(html).toContain("건국대학교");
    expect(html).toContain("전산파일 오류 건");
    expect(html).toContain("이해영");
  });
});
