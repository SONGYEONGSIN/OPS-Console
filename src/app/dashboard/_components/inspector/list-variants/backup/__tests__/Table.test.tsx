import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BackupTable } from "../Table";
import type { ListRow } from "../../../../patterns/ListPattern";

const sampleRow: ListRow = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "백업 요청 1",
  status: "active",
  owner: "Bob",
  substituteEmail: "alice@example.com",
  substituteName: "Alice",
  backupServices: ["서비스1"],
  backupContacts: ["서울대"],
  leaveStartDate: "2026-05-20",
  leaveEndDate: "2026-05-25",
  mailStatus: "sent",
  summary: "내용",
};

describe("BackupTable", () => {
  it("rows 없으면 '데이터 없음' 표기", () => {
    render(<BackupTable rows={[]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });

  it("요청자 / 백업자 / 시작일 / 메일 상태 컬럼 렌더", () => {
    render(
      <BackupTable rows={[sampleRow]} selectedId={null} onSelect={() => {}} />,
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("2026-05-20")).toBeInTheDocument();
    expect(screen.getByText("발송됨")).toBeInTheDocument();
  });

  it("행 클릭 시 onSelect(row) 호출", () => {
    const onSelect = vi.fn();
    render(
      <BackupTable rows={[sampleRow]} selectedId={null} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByText("백업 요청 1").closest("tr")!);
    expect(onSelect).toHaveBeenCalledWith(sampleRow);
  });
});
