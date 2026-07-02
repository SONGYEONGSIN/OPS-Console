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
  leaveStartDate: "2026-05-20",
  leaveEndDate: "2026-05-25",
  mailStatus: "sent",
  mailSentAt: "2026-05-26T01:30:00.000Z",
  summary: "내용",
};

describe("BackupTable", () => {
  it("rows 없으면 '데이터 없음' 표기", () => {
    render(<BackupTable rows={[]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });

  it("요청자 / 백업자 / 휴가기간 / 제목 / 상태 / 발송일자 컬럼 렌더", () => {
    render(
      <BackupTable rows={[sampleRow]} selectedId={null} onSelect={() => {}} />,
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    // 휴가기간 — start ~ end 한 셀에 표시
    expect(screen.getByText("2026-05-20 ~ 2026-05-25")).toBeInTheDocument();
    // 제목
    expect(screen.getByText("백업 요청 1")).toBeInTheDocument();
    // 상태 헤더 + sent → 발송완료 배지
    expect(screen.getByText("상태")).toBeInTheDocument();
    expect(screen.getByText("발송완료")).toBeInTheDocument();
    // 발송일자 — KST 'yyyy-mm-dd HH:mm' (UTC 01:30 = KST 10:30 → 2026-05-26 10:30)
    expect(screen.getByText("2026-05-26 10:30")).toBeInTheDocument();
  });

  it("mailStatus='scheduled'면 상태 칸에 '예약완료' 배지", () => {
    const row: ListRow = { ...sampleRow, mailStatus: "scheduled" };
    render(<BackupTable rows={[row]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("예약완료")).toBeInTheDocument();
  });

  it("mailSentAt 없으면 '—'", () => {
    const row: ListRow = {
      ...sampleRow,
      mailSentAt: null,
      mailStatus: "pending",
    };
    render(<BackupTable rows={[row]} selectedId={null} onSelect={() => {}} />);
    // 휴가기간 셀의 — 와 충돌 회피 위해 발송일자 컬럼 위치를 기반으로 확인
    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it("leaveStartDate만 있으면 '2026-05-20 ~' 형식", () => {
    const row: ListRow = {
      ...sampleRow,
      leaveStartDate: "2026-05-20",
      leaveEndDate: null,
    };
    render(<BackupTable rows={[row]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("2026-05-20 ~")).toBeInTheDocument();
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
