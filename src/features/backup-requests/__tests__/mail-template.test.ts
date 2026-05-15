import { describe, it, expect } from "vitest";
import { buildBackupMailSubject, buildBackupMailHtml } from "../mail-template";
import type { ServiceDetail } from "../schemas";

const serviceA: ServiceDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  service_id: 5072006,
  service_name: "Graduate School",
  university_name: "한양대학교(ERICA)",
  contacts: [],
  note_md: null,
};

const serviceB: ServiceDetail = {
  id: "22222222-2222-4222-8222-222222222222",
  service_id: 1165060,
  service_name: "2025학년도 외국인전형",
  university_name: "연세대학교",
  contacts: [],
  note_md: null,
};

// PR-4: top-level contacts 제거. 연락처는 services 원소 안에.
const baseInput = {
  requesterName: "Bob",
  requesterEmail: "bob@example.com",
  substituteName: "Alice",
  substituteEmail: "alice@example.com",
  leaveStartDate: "2026-05-20",
  leaveEndDate: "2026-05-25",
  services: [serviceA, serviceB],
  summaryMd: "공통 메모입니다.",
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
  it("백업자 이름 + 요청자 이름 + 공통 메모 본문 포함", () => {
    const html = buildBackupMailHtml(baseInput);
    expect(html).toContain("Alice");
    expect(html).toContain("Bob");
    expect(html).toContain("공통 메모입니다.");
  });

  it("XSS 방지 — script 태그 escape (공통 메모)", () => {
    const html = buildBackupMailHtml({
      ...baseInput,
      summaryMd: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("services 카드 — 대학명·서비스명 정규화 표기", () => {
    const html = buildBackupMailHtml(baseInput);
    expect(html).toContain("한양대학교(ERICA) — Graduate School");
    expect(html).toContain("연세대학교 — 2025학년도 외국인전형");
  });

  it("PR-4: 서비스의 contacts chips 렌더", () => {
    const html = buildBackupMailHtml({
      ...baseInput,
      services: [
        {
          ...serviceA,
          contacts: ["한양대 — 양라윤", "한양대 — 박지호"],
        },
      ],
    });
    expect(html).toContain("한양대 — 양라윤");
    expect(html).toContain("한양대 — 박지호");
  });

  it("PR-4: 서비스 note_md 본문에 포함", () => {
    const html = buildBackupMailHtml({
      ...baseInput,
      services: [{ ...serviceA, note_md: "5/20 마감 임박" }],
    });
    expect(html).toContain("5/20 마감 임박");
  });

  it("PR-4: 공통 메모 + 서비스 메모 둘 다 본문에 포함", () => {
    const html = buildBackupMailHtml({
      ...baseInput,
      summaryMd: "휴가 일정 안내",
      services: [{ ...serviceA, note_md: "경찰대학 양식 첨부" }],
    });
    expect(html).toContain("휴가 일정 안내");
    expect(html).toContain("경찰대학 양식 첨부");
  });

  it("services 빈 배열 → (없음) 표기", () => {
    const html = buildBackupMailHtml({ ...baseInput, services: [] });
    expect(html).toContain("(없음)");
  });

  it("서비스 contacts/note_md 모두 없으면 카드는 헤더만 노출", () => {
    // 카드 내부 연락처/메모 섹션은 빈 값이면 생략 (DOM 최소화)
    const html = buildBackupMailHtml({
      ...baseInput,
      services: [serviceA],
    });
    // 헤더는 있음
    expect(html).toContain("한양대학교(ERICA) — Graduate School");
    // 빈 contacts/note_md용 placeholder는 출력 안 함 ("(없음)"은 top-level services 빈 상태에서만)
    expect(html.match(/연락처:/g) ?? []).toHaveLength(0);
    expect(html.match(/메모:/g) ?? []).toHaveLength(0);
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
          contacts: [],
          note_md: null,
        },
      ],
    });
    expect(html).not.toContain("<bad>");
    expect(html).toContain("&lt;bad&gt;");
    expect(html).toContain("X&amp;Y");
  });

  it("PR-4: 서비스의 contacts에 특수문자 있어도 escape", () => {
    const html = buildBackupMailHtml({
      ...baseInput,
      services: [{ ...serviceA, contacts: ["<bad-contact>"] }],
    });
    expect(html).not.toContain("<bad-contact>");
    expect(html).toContain("&lt;bad-contact&gt;");
  });

  it("PR-4: 서비스의 note_md에 특수문자 있어도 escape", () => {
    const html = buildBackupMailHtml({
      ...baseInput,
      services: [{ ...serviceA, note_md: "<script>alert(1)</script>" }],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
