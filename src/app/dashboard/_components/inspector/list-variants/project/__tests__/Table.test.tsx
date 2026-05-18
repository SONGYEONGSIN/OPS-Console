import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectTable } from "../Table";
import type { ListRow } from "../../../../patterns/ListPattern";

function makeRow(over: Partial<ListRow> = {}): ListRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "신제품 프로모션",
    status: "active",
    owner: "송영석",
    priority: "high",
    progress: 30,
    todoStatus: "in_progress",
    startDateYmd: "2026-05-20",
    endDateYmd: "2026-06-30",
    ...over,
  };
}

describe("ProjectTable", () => {
  it("프로젝트명 + 담당 + 진행률 렌더", () => {
    render(
      <ProjectTable rows={[makeRow()]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("신제품 프로모션")).toBeInTheDocument();
    expect(screen.getByText("송영석")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });
});
