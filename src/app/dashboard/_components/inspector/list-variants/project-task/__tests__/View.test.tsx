import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectTaskView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

function makeRow(over: Partial<ListRow> = {}): ListRow {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    name: "블로그 포스팅",
    body: "주간 기획 회의 결과 정리",
    status: "active",
    owner: "ys1114",
    priority: "medium",
    progress: 50,
    todoStatus: "in_progress",
    startDateYmd: "2027-01-15",
    endDateYmd: "2027-01-20",
    ...over,
  };
}

describe("ProjectTaskView", () => {
  it("services 인스펙터 형식 — 4 섹션 (하위 업무 / 일정 / 진행률 / 설명)", () => {
    render(<ProjectTaskView row={makeRow()} />);
    expect(screen.getByText("하위 업무")).toBeInTheDocument();
    expect(screen.getByText("일정")).toBeInTheDocument();
    expect(screen.getByText("진행률")).toBeInTheDocument();
    expect(screen.getByText("설명")).toBeInTheDocument();
  });

  it("우선순위 · 상태 · 담당 chip + 진행률 % 노출", () => {
    render(<ProjectTaskView row={makeRow()} />);
    expect(screen.getByText("보통")).toBeInTheDocument();
    expect(screen.getByText("진행중")).toBeInTheDocument();
    expect(screen.getByText("ys1114")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("시작/마감 일자 — 'YYYY. M. D. (요일)' 포맷 (Table과 통일)", () => {
    render(<ProjectTaskView row={makeRow()} />);
    expect(screen.getByText(/2027\. 1\. 15\./)).toBeInTheDocument();
    expect(screen.getByText(/2027\. 1\. 20\./)).toBeInTheDocument();
  });

  it("body 없으면 설명 섹션 숨김", () => {
    render(<ProjectTaskView row={makeRow({ body: undefined })} />);
    expect(screen.queryByText("설명")).toBeNull();
  });
});
