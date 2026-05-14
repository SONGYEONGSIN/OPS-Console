import { describe, it, expect } from "vitest";
import { buildBackupMailSubject, buildBackupMailHtml } from "../mail-template";
import type { ServiceDetail } from "../schemas";

const serviceA: ServiceDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  service_id: 5072006,
  service_name: "Graduate School",
  university_name: "한양대학교(ERICA)",
};

const serviceB: ServiceDetail = {
  id: "22222222-2222-4222-8222-222222222222",
  service_id: 1165060,
  service_name: "2025학년도 외국인전형",
  university_name: "연세대학교",
};

const baseInput = {
  requesterName: "Bob",
  requesterEmail: "bob@example.com",
  substituteName: "Alice",
  substituteEmail: "alice@example.com",
  leaveStartDate: "2026-05-20",
  leaveEndDate: "2026-05-25",
  services: [serviceA, serviceB],
  contacts: ["서울대"],
  summaryMd: "백업 내용입니다.",
};

describe("buildBackupMailSubject", () => {
  it("요청자 이름 + 기간 포함", () => {
    const subject = buildBackupMailSubject(baseInput);
    expect(subject).toContain("Bob");
    expect(subject).toContain("2026-05-20");
    expect(subject).toContain("2026-05-25");
  });

  it("기간 미지정 시 요청자 이름만 포함", () => {
    const subject = buildBackupMailSubject({
      ...baseInput,
      leaveStartDate: null,
      leaveEndDate: null,
    });
    expect(subject).toContain("Bob");
  });
});

describe("buildBackupMailHtml", () => {
  it("백업자 이름 + 요청자 이름 + 내용 본문 포함", () => {
    const html = buildBackupMailHtml(baseInput);
    expect(html).toContain("Alice");
    expect(html).toContain("Bob");
    expect(html).toContain("백업 내용입니다.");
  });

  it("XSS 방지 — script 태그 escape", () => {
    const html = buildBackupMailHtml({
      ...baseInput,
      summaryMd: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("services chips — 대학명·서비스명 정규화 표기", () => {
    const html = buildBackupMailHtml(baseInput);
    expect(html).toContain("한양대학교(ERICA) — Graduate School");
    expect(html).toContain("연세대학교 — 2025학년도 외국인전형");
  });

  it("contacts chips 렌더", () => {
    const html = buildBackupMailHtml(baseInput);
    expect(html).toContain("서울대");
  });

  it("services 빈 배열 → (없음) 표기", () => {
    const html = buildBackupMailHtml({ ...baseInput, services: [] });
    // 담당 서비스 섹션이 비어있음을 알 수 있어야 함
    expect(html).toContain("(없음)");
  });

  it("기간 미지정 시 '미지정' 표기", () => {
    const html = buildBackupMailHtml({
      ...baseInput,
      leaveStartDate: null,
      leaveEndDate: null,
    });
    expect(html).toContain("미지정");
  });

  it("service의 대학명·서비스명에 HTML 특수문자 있어도 escape", () => {
    const html = buildBackupMailHtml({
      ...baseInput,
      services: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          service_id: 999,
          service_name: "<bad>",
          university_name: "X&Y",
        },
      ],
    });
    expect(html).not.toContain("<bad>");
    expect(html).toContain("&lt;bad&gt;");
    expect(html).toContain("X&amp;Y");
  });
});
