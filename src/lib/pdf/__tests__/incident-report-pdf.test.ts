import { describe, it, expect } from "vitest";
import {
  renderIncidentReportPdf,
  type IncidentReportPdfInput,
} from "../incident-report-pdf";

const base: IncidentReportPdfInput = {
  recipientUniversity: "건국대학교",
  title: "전산파일 오류 건",
  draftDate: "2024. 09. 27",
  authorName: "이해영",
  authorEmail: "haelee@jinhakapply.com",
  approverName: "송영신",
  approverRole: "팀장",
  directorName: "이이화",
  directorRole: "본부장",
  ceoName: "주정현",
  ceoRole: "사장",
  docNumber: null,
  apology: "건국대학교의 무궁한 발전을 기원합니다.",
  gyeongwi: "경위 내용",
  cause: "원인 내용",
  handling: "처리 내용",
  handlingRows: [],
  prevention: "대책 내용",
};

describe("renderIncidentReportPdf", () => {
  it("PDF Buffer(%PDF magic)를 반환한다", { timeout: 20000 }, async () => {
    const buf = await renderIncidentReportPdf(base);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("null 섹션도 안전하게 렌더", { timeout: 20000 }, async () => {
    const buf = await renderIncidentReportPdf({
      ...base,
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
      prevention: null,
    });
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it(
    "처리 표(handlingRows) + 직인이 포함되어도 정상 렌더된다",
    { timeout: 20000 },
    async () => {
      const buf = await renderIncidentReportPdf({
        ...base,
        docNumber: "서비스사업2606-0201(2026. 06. 02)",
        apology: "",
        handling: null,
        handlingRows: [
          { time: "09.27 14:27", content: "대학에서 오류 확인 요청" },
          { time: "09.27 15:20", content: "대학에 완료 피드백" },
        ],
      });
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.byteLength).toBeGreaterThan(1000);
    },
  );
});
