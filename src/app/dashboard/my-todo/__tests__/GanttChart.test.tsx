import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GanttChart } from "../GanttChart";

describe("GanttChart", () => {
  it("items 빈 — 안내 텍스트", () => {
    render(<GanttChart items={[]} />);
    expect(
      screen.getByText(/프로젝트 또는 일정이 없습니다/),
    ).toBeInTheDocument();
  });

  it("3 items 렌더 — 각 행 + bar", () => {
    render(
      <GanttChart
        items={[
          {
            id: "p1",
            name: "프로젝트A",
            startYmd: "2026-05-20",
            endYmd: "2026-06-10",
            priority: "high",
            progress: 30,
            isParent: true,
          },
          {
            id: "t1",
            name: "task1",
            startYmd: "2026-05-20",
            endYmd: "2026-05-25",
            priority: "medium",
            progress: 50,
            isParent: false,
          },
          {
            id: "t2",
            name: "task2",
            startYmd: "2026-05-26",
            endYmd: "2026-06-10",
            priority: "low",
            progress: 0,
            isParent: false,
          },
        ]}
      />,
    );
    expect(screen.getByText("프로젝트A")).toBeInTheDocument();
    expect(screen.getByText("task1")).toBeInTheDocument();
    expect(screen.getByText("task2")).toBeInTheDocument();
    // day-cell grid 기반 — 각 item의 range cell이 1개 이상 노출
    const bars = screen.getAllByTestId("gantt-bar");
    expect(bars.length).toBeGreaterThan(0);
  });

  it("헤더 범위 — 'M. D. (요일) ~ M. D. (요일)' 포맷 (주요업무 탭과 통일)", () => {
    render(
      <GanttChart
        items={[
          {
            id: "p1",
            name: "프로젝트A",
            startYmd: "2027-01-15",
            endYmd: "2027-02-20",
            priority: "high",
            progress: 30,
            isParent: true,
          },
        ]}
      />,
    );
    expect(screen.getByText(/1\. 15\..*~.*2\. 20\./)).toBeInTheDocument();
  });
});
