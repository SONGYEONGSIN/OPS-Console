import { describe, it, expect } from "vitest";
import { renderIncidentPdf } from "../incident-pdf";

describe("renderIncidentPdf", () => {
  it("Buffer 생성 + byteLength > 1KB", { timeout: 15000 }, async () => {
    const buf = await renderIncidentPdf({
      year: 2026,
      universityName: "한양대학교",
      appType: "공통원서",
      category: "결제 오류",
      title: "결제 페이지 문구 오안내",
      occurredDate: "2026-05-20",
      resolvedDate: "2026-05-21",
      causeSummary: "결제 페이지에서 안내 문구가 잘못 표기됨.",
      rootCause: "QA 단계에서 누락된 케이스.",
      resolution: "문구 즉시 수정 + 핫픽스 배포.",
      prevention: "QA 체크리스트에 결제 문구 점검 항목 추가.",
      department: "운영부-운영1팀",
      assigneeName: "송영신",
      assigneeEmail: "ys1114@jinhakapply.com",
      reporterName: "허승철",
      reporterEmail: "alcure23@jinhakapply.com",
      status: "처리완료",
      createdAt: "2026-05-27T00:00:00Z",
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it(
    "nullable 필드 (작성 안 한 섹션)도 throw 없이 렌더",
    { timeout: 15000 },
    async () => {
      const buf = await renderIncidentPdf({
        year: 2026,
        universityName: null,
        appType: "PIMS",
        category: "기타",
        title: "초기 등록 사고",
        occurredDate: null,
        resolvedDate: null,
        causeSummary: null,
        rootCause: null,
        resolution: null,
        prevention: null,
        department: "운영부-운영2팀",
        assigneeName: "운영자A",
        assigneeEmail: "a@example.com",
        reporterName: "보고자B",
        reporterEmail: "b@example.com",
        status: "미처리",
        createdAt: "2026-05-27T00:00:00Z",
      });
      expect(buf.byteLength).toBeGreaterThan(500);
    },
  );
});
