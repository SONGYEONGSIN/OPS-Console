import { describe, it, expect } from "vitest";
import {
  buildHandoverMailSubject,
  buildHandoverMailHtml,
} from "../mail-template";

describe("handover mail template", () => {
  it("subject — '[운영부 상황실]' 브랜드 + 대학명·서비스명 + '인수인계 요청'", () => {
    const s = buildHandoverMailSubject({
      universityName: "한예종",
      serviceName: "KARTS",
    });
    expect(s).toContain("[운영부 상황실]");
    expect(s).toContain("한예종");
    expect(s).toContain("KARTS");
    expect(s).toContain("인수인계 요청");
    expect(s).not.toContain("Folio");
    expect(s).not.toContain("TEST");
  });

  it("html — 인계자/인수자/서비스/메모 모두 표시 + 안내 문구", () => {
    const h = buildHandoverMailHtml({
      universityName: "한예종",
      serviceName: "KARTS",
      applicationType: "공통원서",
      fromName: "허승철",
      fromEmail: "from@x.com",
      toName: "송영신",
      toEmail: "to@x.com",
      notes: "참고할 점 있음",
      historyUrl: "https://folio.local/dashboard/handover?tab=history",
    });
    expect(h).toContain("한예종");
    expect(h).toContain("KARTS");
    expect(h).toContain("허승철");
    expect(h).toContain("송영신");
    expect(h).toContain("참고할 점 있음");
    expect(h).toContain("folio.local/dashboard/handover?tab=history");
  });

  it("html — notes 없으면 메모 섹션 미표시", () => {
    const h = buildHandoverMailHtml({
      universityName: "한예종",
      serviceName: "KARTS",
      applicationType: "공통원서",
      fromName: "허승철",
      fromEmail: "from@x.com",
      toName: "송영신",
      toEmail: "to@x.com",
      notes: null,
      historyUrl: "https://x",
    });
    expect(h).not.toContain("인계 메모");
  });

  it("html — 브랜딩 통일: '운영부 상황실 · 인수인계' 헤더 + '운영부 상황실 자동발송' 푸터, 'Folio'/'TEST'/'테스트' 부재", () => {
    const h = buildHandoverMailHtml({
      universityName: "한예종",
      serviceName: "KARTS",
      applicationType: "공통원서",
      fromName: "허승철",
      fromEmail: "from@x.com",
      toName: "송영신",
      toEmail: "to@x.com",
      notes: null,
      historyUrl: "https://x",
    });
    expect(h).toContain("운영부 상황실 · 인수인계");
    expect(h).toContain("운영부 상황실 자동발송");
    expect(h).not.toContain("FOLIO");
    expect(h).not.toContain("Folio");
    expect(h).not.toMatch(/테스트/);
    expect(h).not.toMatch(/TEST/);
  });

  it("html — 배경색(background:#xxx) 미포함 — 메일 클라이언트 기본 테마 사용", () => {
    const h = buildHandoverMailHtml({
      universityName: "한예종",
      serviceName: "KARTS",
      applicationType: "공통원서",
      fromName: "허승철",
      fromEmail: "from@x.com",
      toName: "송영신",
      toEmail: "to@x.com",
      notes: "메모 있음",
      historyUrl: "https://x",
    });
    // 'background:#xxx' / 'background-color:#xxx' 직접 색 지정이 없어야 함
    expect(h).not.toMatch(/background\s*:\s*#[0-9a-fA-F]{3,8}/);
    expect(h).not.toMatch(/background-color\s*:\s*#[0-9a-fA-F]{3,8}/);
  });

  it("html — XSS 방지 escape", () => {
    const h = buildHandoverMailHtml({
      universityName: "<script>alert(1)</script>",
      serviceName: "KARTS",
      applicationType: "공통원서",
      fromName: "허승철",
      fromEmail: "from@x.com",
      toName: "송영신",
      toEmail: "to@x.com",
      notes: null,
      historyUrl: "https://x",
    });
    expect(h).not.toContain("<script>alert");
    expect(h).toContain("&lt;script&gt;");
  });
});
