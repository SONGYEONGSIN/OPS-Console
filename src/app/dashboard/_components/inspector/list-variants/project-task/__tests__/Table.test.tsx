import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectTaskTable } from "../Table";
import type { ListRow } from "../../../../patterns/ListPattern";

function makeRow(over: Partial<ListRow> = {}): ListRow {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    name: "블로그 포스팅",
    status: "active",
    owner: "송영석",
    priority: "medium",
    progress: 50,
    todoStatus: "in_progress",
    startDateYmd: "2026-05-22",
    endDateYmd: "2026-05-23",
    projectId: "11111111-1111-4111-8111-111111111111",
    ...over,
  };
}

describe("ProjectTaskTable", () => {
  it("task명 + 진행률 + 기간 렌더", () => {
    render(
      <ProjectTaskTable
        rows={[makeRow()]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("블로그 포스팅")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("빈 행 — 데이터 없음", () => {
    render(<ProjectTaskTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });
});
