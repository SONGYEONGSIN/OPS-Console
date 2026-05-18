import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "신제품 프로모션",
  status: "active",
  owner: "송영석",
  priority: "high",
  progress: 30,
  todoStatus: "in_progress",
  startDateYmd: "2026-05-20",
  endDateYmd: "2026-06-30",
  description: "이번 분기 핵심 캠페인",
  totalTaskCount: 5,
  doneTaskCount: 1,
};

describe("ProjectView", () => {
  it("프로젝트명/기간/진행률/총 task 표시", () => {
    render(<ProjectView row={baseRow} />);
    expect(screen.getByText("이번 분기 핵심 캠페인")).toBeInTheDocument();
    expect(screen.getByText(/2026-05-20/)).toBeInTheDocument();
    expect(screen.getByText(/2026-06-30/)).toBeInTheDocument();
    expect(screen.getByText(/sub-task 1 \/ 5 완료/)).toBeInTheDocument();
  });
});
