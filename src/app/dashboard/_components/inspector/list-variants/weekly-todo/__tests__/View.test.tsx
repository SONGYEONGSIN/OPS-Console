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
});
