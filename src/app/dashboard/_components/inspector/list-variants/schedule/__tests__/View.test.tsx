import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScheduleView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

function makeRow(over: Partial<ListRow> = {}): ListRow {
  return {
    id: "33bd97a3-a243-4896-a242-ca6b0edb62f4",
    name: "주간 운영 회의",
    body: "이번 주 운영 안건 점검",
    status: "active",
    owner: "김지나",
    scheduleType: "event",
    start_at: "2026-05-15T01:00:00Z", // KST 10:00
    end_at: "2026-05-15T02:00:00Z", // KST 11:00
    allDay: false,
    assigneeEmail: "jina@example.com",
    createdByEmail: "ops@example.com",
    ...over,
  };
}

describe("ScheduleView", () => {
  it("제목/설명/담당자 표시", () => {
    render(<ScheduleView row={makeRow()} />);
    expect(screen.getByText("이번 주 운영 안건 점검")).toBeInTheDocument();
    expect(screen.getByText("김지나")).toBeInTheDocument();
  });

  it("타입 chip(이벤트) 노출", () => {
    render(<ScheduleView row={makeRow({ scheduleType: "event" })} />);
    expect(screen.getByText("이벤트")).toBeInTheDocument();
  });

  it("시작/종료 — services 시즌 톤(YYYY. MM. DD. HH:MM)으로 별도 row 표시", () => {
    render(<ScheduleView row={makeRow()} />);
    // KST 10:00 시작, 11:00 종료 — 두 row로 분리
    expect(screen.getByText(/2026\. 05\. 15\. 10:00/)).toBeInTheDocument();
    expect(screen.getByText(/2026\. 05\. 15\. 11:00/)).toBeInTheDocument();
  });

  it("allDay=true면 '종일' 라벨 노출", () => {
    render(<ScheduleView row={makeRow({ allDay: true, end_at: null })} />);
    expect(screen.getByText("종일")).toBeInTheDocument();
  });

  it("body 없으면 설명 섹션 숨김", () => {
    render(<ScheduleView row={makeRow({ body: undefined })} />);
    expect(screen.queryByText("설명")).toBeNull();
  });

  it("assignee 없으면 '팀 공통' 표시", () => {
    render(
      <ScheduleView
        row={makeRow({ assigneeEmail: null, owner: "" })}
      />,
    );
    expect(screen.getByText("팀 공통")).toBeInTheDocument();
  });
});
