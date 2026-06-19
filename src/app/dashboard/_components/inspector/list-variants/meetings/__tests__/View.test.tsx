import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MeetingView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

const row: ListRow = {
  id: "m-1",
  name: "월간 운영회의",
  status: "active",
  owner: "lee@ops.test",
  meetingType: "regular",
  meetingTitle: "월간 운영회의",
  meetingDate: "2026-06-19 14:00",
  meetingAuthor: "이해영",
  meetingStatus: "draft",
};

describe("MeetingView (표준 인스펙터)", () => {
  it("표준 Section/DefList로 회의 정보를 노출한다", () => {
    render(<MeetingView row={row} />);
    expect(screen.getByText("회의 정보")).toBeInTheDocument();
    expect(screen.getByText("제목")).toBeInTheDocument();
    expect(screen.getAllByText(/월간 운영회의/).length).toBeGreaterThan(0);
    expect(screen.getByText("정기회의")).toBeInTheDocument();
    expect(screen.getByText("작성중")).toBeInTheDocument();
    expect(screen.getByText(/2026-06-19 14:00/)).toBeInTheDocument();
    expect(screen.getByText("이해영")).toBeInTheDocument();
  });

  it("회의록 편집 화면으로 이동하는 링크를 제공한다", () => {
    render(<MeetingView row={row} />);
    const link = screen.getByRole("link", { name: /편집 화면 열기/ });
    expect(link).toHaveAttribute("href", "/dashboard/meetings/m-1");
  });
});
