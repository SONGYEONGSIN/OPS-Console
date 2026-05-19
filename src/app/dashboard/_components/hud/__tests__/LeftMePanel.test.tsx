import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeftMePanel } from "../LeftMePanel";

describe("LeftMePanel", () => {
  const stats = {
    todoTodayCount: 4,
    todoWeekCount: 12,
    servicesMineCount: 5,
    handoverInProgressCount: 1,
    receivablesPendingCount: 2,
    myActivities: [
      { ts: "14:23", who: "송영석", act: "계약 승인" },
      { ts: "14:10", who: "송영석", act: "#INC-042 신규" },
    ],
  };

  it("나 KPI 카운트 4종 노출", () => {
    render(<LeftMePanel stats={stats} />);
    expect(screen.getByText("4")).toBeInTheDocument(); // todoToday
    expect(screen.getByText("5")).toBeInTheDocument(); // services
    expect(screen.getByText("1")).toBeInTheDocument(); // handover
    expect(screen.getByText("2")).toBeInTheDocument(); // receivables
  });

  it("내 활동 row 노출", () => {
    render(<LeftMePanel stats={stats} />);
    expect(screen.getByText(/계약 승인/)).toBeInTheDocument();
    expect(screen.getByText(/INC-042/)).toBeInTheDocument();
  });
});
