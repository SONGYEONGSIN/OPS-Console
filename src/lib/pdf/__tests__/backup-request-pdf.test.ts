import { describe, it, expect } from "vitest";
import { renderBackupRequestPdf } from "../backup-request-pdf";

describe("renderBackupRequestPdf", () => {
  it("Buffer 생성 + byteLength > 1KB", { timeout: 15000 }, async () => {
    const buf = await renderBackupRequestPdf({
      requesterName: "Bob",
      requesterEmail: "bob@example.com",
      substituteName: "Alice",
      substituteEmail: "alice@example.com",
      leaveStartDate: "2026-05-20",
      leaveEndDate: "2026-05-25",
      services: ["서비스1", "서비스2"],
      contacts: ["서울대"],
      summaryMd: "이번 휴가 기간 동안의 백업 내용입니다.",
      createdAt: "2026-05-13T00:00:00Z",
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it("한글 입력 시 throw하지 않음", { timeout: 15000 }, async () => {
    const buf = await renderBackupRequestPdf({
      requesterName: "한글이름",
      requesterEmail: "bob@example.com",
      substituteName: "백업자한글",
      substituteEmail: "alice@example.com",
      leaveStartDate: null,
      leaveEndDate: null,
      services: ["한글서비스"],
      contacts: ["한글대학"],
      summaryMd: "한글 내용 테스트 — 진행 상태, 마감일, 주의사항.",
      createdAt: "2026-05-13T00:00:00Z",
    });
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it("빈 services/contacts 처리", { timeout: 15000 }, async () => {
    const buf = await renderBackupRequestPdf({
      requesterName: "Bob",
      requesterEmail: "bob@example.com",
      substituteName: "Alice",
      substituteEmail: "alice@example.com",
      leaveStartDate: null,
      leaveEndDate: null,
      services: [],
      contacts: [],
      summaryMd: "내용",
      createdAt: "2026-05-13T00:00:00Z",
    });
    expect(buf.byteLength).toBeGreaterThan(500);
  });
});
