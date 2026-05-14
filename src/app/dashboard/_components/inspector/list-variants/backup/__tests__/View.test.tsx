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
    },
  ],
  backupContacts: ["서울대"],
  leaveStartDate: "2026-05-20",
  leaveEndDate: "2026-05-25",
  mailStatus: "sent",
  summary: "백업 내용입니다",
  mailError: null,
};

describe("BackupView", () => {
  it("백업자·기간·서비스·연락처·요약 노출 (services는 대학명·서비스명 정규화)", () => {
    render(<BackupView row={row} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText(/2026-05-20/)).toBeInTheDocument();
    // PR-2: services chip은 "대학명 — 서비스명" 형태
    expect(screen.getByText(/한양대학교\s*—\s*서비스1/)).toBeInTheDocument();
    expect(screen.getByText("서울대")).toBeInTheDocument();
    expect(screen.getByText("백업 내용입니다")).toBeInTheDocument();
  });

  it("services chip은 /dashboard/services?q= deep-link로 렌더", () => {
    const { container } = render(<BackupView row={row} />);
    const link = container.querySelector('a[href*="/dashboard/services?q="]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toContain(encodeURIComponent("서비스1"));
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
