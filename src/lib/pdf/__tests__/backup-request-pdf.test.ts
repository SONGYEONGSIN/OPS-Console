import { describe, it, expect } from "vitest";
import {
  renderBackupRequestPdf,
  type PdfServiceDetail,
} from "../backup-request-pdf";

const svcA: PdfServiceDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  service_id: 5072006,
  service_name: "서비스1",
  university_name: "한양대학교",
  contacts: [
    {
      contact_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      customer_name: "양라윤",
      university_name: "한양대",
      email: "yry@hanyang.ac.kr",
      phone: "010-1111-2222",
    },
  ],
  note_md: null,
};

const svcB: PdfServiceDetail = {
  id: "22222222-2222-4222-8222-222222222222",
  service_id: 1165060,
  service_name: "서비스2",
  university_name: "연세대학교",
  contacts: [],
  note_md: "마감일 5/20",
};

describe("renderBackupRequestPdf", () => {
  it("Buffer 생성 + byteLength > 1KB", { timeout: 15000 }, async () => {
    const buf = await renderBackupRequestPdf({
      requesterName: "Bob",
      requesterEmail: "bob@example.com",
      substituteName: "Alice",
      substituteEmail: "alice@example.com",
      leaveStartDate: "2026-05-20",
      leaveEndDate: "2026-05-25",
      services: [svcA, svcB],
      summaryMd: "이번 휴가 기간 동안의 공통 메모입니다.",
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
      services: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          service_id: 999,
          service_name: "한글서비스",
          university_name: "한글대학교",
          contacts: [
            {
              contact_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              customer_name: "한글연락처",
              university_name: "한글대",
              email: null,
              phone: null,
            },
          ],
          note_md: "한글메모",
        },
      ],
      summaryMd: "한글 공통 메모 — 진행 상태, 마감일, 주의사항.",
      createdAt: "2026-05-13T00:00:00Z",
    });
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it("빈 services 처리 (공통 메모만)", { timeout: 15000 }, async () => {
    const buf = await renderBackupRequestPdf({
      requesterName: "Bob",
      requesterEmail: "bob@example.com",
      substituteName: "Alice",
      substituteEmail: "alice@example.com",
      leaveStartDate: null,
      leaveEndDate: null,
      services: [],
      summaryMd: "내용",
      createdAt: "2026-05-13T00:00:00Z",
    });
    expect(buf.byteLength).toBeGreaterThan(500);
  });
});
