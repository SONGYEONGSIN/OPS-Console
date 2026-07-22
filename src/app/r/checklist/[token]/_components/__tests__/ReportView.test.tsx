import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportView } from "../ReportView";
import type { ChecklistRound, ChecklistItem } from "@/features/checklist/schemas";

const round: ChecklistRound = {
  id: "R1",
  title: "2027학년도 수시모집",
  periodStart: "2026-08-01",
  periodEnd: "2026-09-01",
  status: "active",
  createdBy: "me@x",
  createdAt: "2026-07-22",
};
const items: ChecklistItem[] = [
  { id: "i1", roundId: "R1", department: "개발부", category: "서버/시스템", title: "웹 서버 동작 확인", status: "done", note: "정상", sortOrder: 0 },
  { id: "i2", roundId: "R1", department: "운영부", category: "결제사", title: "결제사 세팅", status: "in_progress", note: "", sortOrder: 0 },
];

describe("ReportView", () => {
  it("회차 제목·부서·항목·상태 라벨을 렌더한다", () => {
    render(<ReportView round={round} items={items} />);
    expect(screen.getByText("2027학년도 수시모집")).toBeInTheDocument();
    expect(screen.getByText("개발부")).toBeInTheDocument();
    expect(screen.getByText("웹 서버 동작 확인")).toBeInTheDocument();
    expect(screen.getByText("결제사 세팅")).toBeInTheDocument();
    expect(screen.getAllByText("완료").length).toBeGreaterThan(0);
  });

  it("빈 회차면 안내 문구", () => {
    render(<ReportView round={round} items={[]} />);
    expect(screen.getByText(/항목이 없습니다/)).toBeInTheDocument();
  });
});
