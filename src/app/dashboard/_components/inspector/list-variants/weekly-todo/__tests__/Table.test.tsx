import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeeklyTodoTable } from "../Table";
import type { ListRow } from "../../../../patterns/ListPattern";

function makeRow(over: Partial<ListRow> = {}): ListRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "신제품 프로모션 기획",
    status: "active",
    owner: "",
    priority: "high",
    done: false,
    category: "신제품 프로모션",
    progress: 50,
    dueAt: "2026-05-22T00:00:00Z",
    todoStatus: "in_progress",
    ...over,
  };
}

describe("WeeklyTodoTable", () => {
  it("카테고리 + 진행률 + 제목 렌더", () => {
    render(
      <WeeklyTodoTable
        rows={[makeRow()]}
        selectedId={null}
        onSelect={vi.fn()}
        onToggleDone={vi.fn(async () => {})}
      />,
    );
    expect(screen.getByText("신제품 프로모션 기획")).toBeInTheDocument();
    expect(screen.getByText("신제품 프로모션")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("빈 행 — '데이터 없음'", () => {
    render(
      <WeeklyTodoTable
        rows={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onToggleDone={vi.fn(async () => {})}
      />,
    );
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });
});
