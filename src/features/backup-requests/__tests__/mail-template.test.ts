import { describe, it, expect } from "vitest";
import { buildBackupMailSubject, buildBackupMailHtml } from "../mail-template";

const baseInput = {
  requesterName: "Bob",
  requesterEmail: "bob@example.com",
  substituteName: "Alice",
  substituteEmail: "alice@example.com",
  leaveStartDate: "2026-05-20",
  leaveEndDate: "2026-05-25",
  services: ["서비스1", "서비스2"],
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

  it("services / contacts chips 렌더", () => {
    const html = buildBackupMailHtml(baseInput);
    expect(html).toContain("서비스1");
    expect(html).toContain("서울대");
  });

  it("기간 미지정 시 '미지정' 표기", () => {
    const html = buildBackupMailHtml({
      ...baseInput,
      leaveStartDate: null,
      leaveEndDate: null,
    });
    expect(html).toContain("미지정");
  });
});
