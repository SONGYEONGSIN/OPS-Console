import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeeklyTodoView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

function makeRow(over: Partial<ListRow> = {}): ListRow {
  return {
    id: "4b59777e-8c3b-4ddf-bf06-788dd5421ffc",
    name: "신규 운영자 OJT 일정 작성",
    body: "정원 검토 + 일정 픽스",
    status: "active",
    owner: "송영석",
    priority: "high",
    done: false,
    dueAt: "2026-05-22T00:00:00Z",
    category: "운영팀 운영",
    progress: 30,
    todoStatus: "in_progress",
    ...over,
  };
}

describe("WeeklyTodoView", () => {
  it("카테고리/우선순위/상태/진행률 표시", () => {
    render(<WeeklyTodoView row={makeRow()} />);
    expect(screen.getByText("운영팀 운영")).toBeInTheDocument();
    expect(screen.getByText("높음")).toBeInTheDocument();
    expect(screen.getByText("진행중")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("body가 있으면 설명 섹션 노출", () => {
    render(<WeeklyTodoView row={makeRow()} />);
    expect(screen.getByText("정원 검토 + 일정 픽스")).toBeInTheDocument();
  });

  it("body 없으면 설명 섹션 숨김", () => {
    render(<WeeklyTodoView row={makeRow({ body: undefined })} />);
    expect(screen.queryByText("설명")).toBeNull();
  });

  it("done=true면 '완료' chip 노출", () => {
    render(<WeeklyTodoView row={makeRow({ done: true, progress: 100 })} />);
    expect(screen.getByText("완료됨")).toBeInTheDocument();
  });

  it("category 없으면 카테고리 칸 '-'", () => {
    render(<WeeklyTodoView row={makeRow({ category: undefined })} />);
    expect(screen.getByText(/카테고리/)).toBeInTheDocument();
  });

  it("services 인스펙터 형식 — 4 섹션 (할 일 기본 / 일정 / 진행률 / 설명)", () => {
    render(<WeeklyTodoView row={makeRow()} />);
    expect(screen.getByText("할 일 기본")).toBeInTheDocument();
    expect(screen.getByText("일정")).toBeInTheDocument();
    expect(screen.getByText("진행률")).toBeInTheDocument();
    expect(screen.getByText("설명")).toBeInTheDocument();
  });

  it("doneAt이 있으면 '완료일' 항목 노출, 없으면 '-'", () => {
    const { rerender } = render(
      <WeeklyTodoView
        row={makeRow({ done: true, doneAt: "2026-05-18T15:00:00Z", progress: 100 })}
      />,
    );
    expect(screen.getByText("완료일")).toBeInTheDocument();
    rerender(<WeeklyTodoView row={makeRow({ doneAt: null })} />);
    expect(screen.getByText("완료일")).toBeInTheDocument();
  });
});
