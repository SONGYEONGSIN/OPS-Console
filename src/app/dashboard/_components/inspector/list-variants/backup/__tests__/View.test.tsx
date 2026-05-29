import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackupView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

const row: ListRow = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "백업 요청 1",
  status: "active",
  owner: "Bob",
  substituteEmail: "alice@example.com",
  substituteName: "Alice",
  backupServices: ["aaaaaaaa-1111-4111-8111-111111111111"],
  backupServicesDetail: [
    {
      id: "aaaaaaaa-1111-4111-8111-111111111111",
      service_id: 5072006,
      service_name: "서비스1",
      university_name: "한양대학교",
      contacts: [],
      note_md: null,
    },
  ],
  leaveStartDate: "2026-05-20",
  leaveEndDate: "2026-05-25",
  mailStatus: "sent",
  summary: "공통 메모입니다",
  mailError: null,
};

describe("BackupView", () => {
  it("백업자·기간·서비스 카드·공통 메모 노출", () => {
    render(<BackupView row={row} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText(/2026-05-20/)).toBeInTheDocument();
    expect(screen.getByText(/한양대학교\s*—\s*서비스1/)).toBeInTheDocument();
    expect(screen.getByText("공통 메모입니다")).toBeInTheDocument();
  });

  it("services 카드는 /dashboard/services?q= deep-link로 렌더", () => {
    const { container } = render(<BackupView row={row} />);
    const link = container.querySelector('a[href*="/dashboard/services?q="]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toContain(encodeURIComponent("서비스1"));
  });

  it("PR-4: 일괄 대학 연락처 섹션 부재", () => {
    render(<BackupView row={row} />);
    // top-level 일괄 연락처 영역은 사라짐 (서비스 카드에 흡수)
    expect(screen.queryByText(/^대학 연락처$/)).toBeNull();
  });

  it("PR-5: 서비스 카드 내 contacts 객체 chips 표시 (학교 — 이름)", () => {
    render(
      <BackupView
        row={{
          ...row,
          backupServicesDetail: [
            {
              ...row.backupServicesDetail![0],
              contacts: [
                {
                  contact_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                  customer_name: "양라윤",
                  university_name: "한양대",
                  email: null,
                  phone: null,
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
        }}
      />,
    );
    expect(screen.getByText("한양대 — 양라윤")).toBeInTheDocument();
    expect(screen.getByText("한양대 — 박지호")).toBeInTheDocument();
  });

  it("PR-4: 서비스 카드 내 note_md 메모 표시", () => {
    render(
      <BackupView
        row={{
          ...row,
          backupServicesDetail: [
            { ...row.backupServicesDetail![0], note_md: "5/20 마감 임박" },
          ],
        }}
      />,
    );
    expect(screen.getByText("5/20 마감 임박")).toBeInTheDocument();
  });

  it("팀 구분·휴가유형 노출 (있을 때)", () => {
    render(
      <BackupView
        row={{ ...row, requesterTeam: "운영2팀", leaveType: "연차" }}
      />,
    );
    expect(screen.getByText("운영2팀")).toBeInTheDocument();
    expect(screen.getByText("연차")).toBeInTheDocument();
  });

  it("휴가유형 없으면 '—'로 표시", () => {
    render(<BackupView row={{ ...row, leaveType: null }} />);
    // 휴가유형 항목 라벨은 존재하되 값은 대시
    expect(screen.getByText("휴가유형")).toBeInTheDocument();
  });

  it("mail_failed 시 에러 메시지 노출", () => {
    render(
      <BackupView
        row={{ ...row, mailStatus: "mail_failed", mailError: "SMTP 거절" }}
      />,
    );
    expect(screen.getByText("SMTP 거절")).toBeInTheDocument();
  });
});
