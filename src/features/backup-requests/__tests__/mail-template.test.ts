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
  it("'[운영부 상황실]' 브랜드 + 요청자 이름 + 기간 포함", () => {
    const subject = buildBackupMailSubject(baseInput);
    expect(subject).toContain("[운영부 상황실]");
    expect(subject).toContain("Bob");
    expect(subject).toContain("2026-05-20");
    expect(subject).toContain("2026-05-25");
    expect(subject).not.toContain("Folio");
  });

  it("기간 미지정 시 '[운영부 상황실]' + 요청자 이름만 포함", () => {
    const subject = buildBackupMailSubject({
      ...baseInput,
      leaveStartDate: null,
      leaveEndDate: null,
    });
    expect(subject).toContain("[운영부 상황실]");
    expect(subject).toContain("Bob");
    expect(subject).not.toContain("Folio");
  });
});

describe("buildBackupMailHtml", () => {
  it("백업자 이름 + 요청자 이름 + 공통 메모 본문 포함", () => {
    const html = buildBackupMailHtml(baseInput);
    expect(html).toContain("Alice");
    expect(html).toContain("Bob");
    expect(html).toContain("공통 메모입니다.");
  });

  it("브랜딩 통일: '운영부 상황실 · 백업 요청' 헤더 + '운영부 상황실 자동발송' 푸터, 'Folio' 부재", () => {
    const html = buildBackupMailHtml(baseInput);
    expect(html).toContain("운영부 상황실 · 백업 요청");
    expect(html).toContain("운영부 상황실 자동발송");
    expect(html).not.toContain("Folio");
    expect(html).not.toMatch(/FOLIO/);
  });

  it("배경색(background:#xxx) 미포함 — 메일 클라이언트 기본 테마", () => {
    const html = buildBackupMailHtml(baseInput);
    expect(html).not.toMatch(/background\s*:\s*#[0-9a-fA-F]{3,8}/);
    expect(html).not.toMatch(/background-color\s*:\s*#[0-9a-fA-F]{3,8}/);
  });

  it("XSS 방지 — script 태그 escape (공통 메모)", () => {
    const html = buildBackupMailHtml({
      ...baseInput,
      summaryMd: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("services 카드 — 대학명·서비스명(서비스ID) 표기", () => {
    const html = buildBackupMailHtml(baseInput);
    expect(html).toContain("한양대학교(ERICA) — Graduate School(5072006)");
    expect(html).toContain("연세대학교 — 2025학년도 외국인전형(1165060)");
  });

  it("PR-5: 서비스의 contacts 객체 chips 렌더 — 이름 + 이메일 + 전화 한 줄 표시", () => {
    const html = buildBackupMailHtml({
      ...baseInput,
      services: [
        {
          ...serviceA,
          contacts: [
            {
              contact_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              customer_name: "양라윤",
              university_name: "한양대",
              email: "yry@hanyang.ac.kr",
              phone: "010-1111-2222",
            },
            {
              contact_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              customer_name: "박지호",
              university_name: "한양대",
              email: null,
              phone: null,
            },
          ],
        },
      ],
    });
    // 라벨에 학교 — 이름
    expect(html).toContain("한양대 — 양라윤");
    expect(html).toContain("한양대 — 박지호");
    // 이메일/전화 노출
    expect(html).toContain("yry@hanyang.ac.kr");
    expect(html).toContain("010-1111-2222");
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

  it("PR-5: 서비스의 contacts 객체 필드에 특수문자 있어도 escape", () => {
    const html = buildBackupMailHtml({
      ...baseInput,
      services: [
        {
          ...serviceA,
          contacts: [
            {
              contact_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              customer_name: "<bad-contact>",
              university_name: "X&Y",
              email: null,
              phone: null,
            },
          ],
        },
      ],
    });
    expect(html).not.toContain("<bad-contact>");
    expect(html).toContain("&lt;bad-contact&gt;");
    expect(html).toContain("X&amp;Y");
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
