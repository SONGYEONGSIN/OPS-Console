import { describe, it, expect } from "vitest";
import { renderIncidentReportPdf } from "../incident-report-pdf";

describe("renderIncidentReportPdf", () => {
  it("PDF Buffer(%PDF magic)를 반환한다", { timeout: 20000 }, async () => {
    const buf = await renderIncidentReportPdf({
      recipientUniversity: "건국대학교",
      title: "전산파일 오류 건",
      draftDate: "2024. 09. 27",
      authorName: "이해영",
      approverName: "송영신",
      directorName: "이이화",
      ceoName: "주정현",
      docNumber: null,
      apology: "건국대학교의 무궁한 발전을 기원합니다.",
      gyeongwi: "경위 내용",
      cause: "원인 내용",
      handling: "처리 내용",
      prevention: "대책 내용",
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("null 섹션도 안전하게 렌더", { timeout: 20000 }, async () => {
    const buf = await renderIncidentReportPdf({
      recipientUniversity: "서울대학교",
      title: "오류",
      draftDate: "2024. 11. 18",
      authorName: "윤지혜",
      approverName: null,
      directorName: null,
      ceoName: null,
      docNumber: "서비스사업2411-1801",
      apology: "사과",
      gyeongwi: null,
      cause: null,
      handling: null,
      prevention: null,
    });
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
