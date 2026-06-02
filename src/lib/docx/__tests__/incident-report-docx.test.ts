import { describe, it, expect } from "vitest";
import { renderIncidentReportDocx } from "../incident-report-docx";

describe("renderIncidentReportDocx", () => {
  it("docx(zip PK magic) Buffer를 반환한다", async () => {
    const buf = await renderIncidentReportDocx({
      recipientUniversity: "건국대학교",
      title: "전산파일 오류 건",
      draftDate: "2024. 09. 27",
      authorName: "이해영",
      authorEmail: "haelee@jinhakapply.com",
      approverName: "송영신",
      directorName: "이이화",
      ceoName: "주정현",
      docNumber: null,
      apology: "사과 본문",
      gyeongwi: "경위",
      cause: "원인",
      handling: "처리",
      handlingRows: [],
      prevention: "대책",
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
  });
  it("null 섹션/결재자도 안전", async () => {
    const buf = await renderIncidentReportDocx({
      recipientUniversity: "서울대학교",
      title: "오류",
      draftDate: "2024. 11. 18",
      authorName: "윤지혜",
      authorEmail: "wnlgp@jinhakapply.com",
      approverName: null,
      directorName: null,
      ceoName: null,
      docNumber: "서비스사업2411-1801",
      apology: "사과",
      gyeongwi: null,
      cause: null,
      handling: null,
      handlingRows: [],
      prevention: null,
    });
    expect(buf.subarray(0, 2).toString()).toBe("PK");
  });
});
