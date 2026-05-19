import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "신제품 프로모션",
  body: "이번 분기 핵심 캠페인",
  status: "active",
  owner: "송영석",
  priority: "high",
  progress: 30,
  todoStatus: "in_progress",
  startDateYmd: "2027-01-15",
  endDateYmd: "2027-02-20",
  description: "이번 분기 핵심 캠페인",
  totalTaskCount: 5,
  doneTaskCount: 1,
};

describe("ProjectView", () => {
  it("services 인스펙터 형식 — 4 섹션 (프로젝트 / 일정 / 진행률 / 설명)", () => {
    render(<ProjectView row={baseRow} />);
    expect(screen.getByText("프로젝트")).toBeInTheDocument();
    expect(screen.getByText("일정")).toBeInTheDocument();
    expect(screen.getByText("진행률")).toBeInTheDocument();
    expect(screen.getByText("설명")).toBeInTheDocument();
  });

  it("우선순위 · 상태 · 담당 chip + 진행률 % + sub-task 카운트", () => {
    render(<ProjectView row={baseRow} />);
    expect(screen.getByText("높음")).toBeInTheDocument();
    expect(screen.getByText("진행중")).toBeInTheDocument();
    expect(screen.getByText("송영석")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText(/sub-task 1 \/ 5 완료/)).toBeInTheDocument();
  });

  it("시작/마감 일자 — 'YYYY. M. D. (요일)' 포맷", () => {
    render(<ProjectView row={baseRow} />);
    expect(screen.getByText(/2027\. 1\. 15\./)).toBeInTheDocument();
    expect(screen.getByText(/2027\. 2\. 20\./)).toBeInTheDocument();
  });

  it("description 표시", () => {
    render(<ProjectView row={baseRow} />);
    expect(screen.getByText("이번 분기 핵심 캠페인")).toBeInTheDocument();
  });

  it("description 없으면 설명 섹션 숨김", () => {
    render(<ProjectView row={{ ...baseRow, description: undefined }} />);
    expect(screen.queryByText("설명")).toBeNull();
  });
});
