import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityTimeline } from "../ActivityTimeline";
import type { ActivityLogEntry } from "../activity-log";

const entries: ActivityLogEntry[] = [
  {
    id: "1",
    atIso: "x",
    hms: "09:29:00",
    minutesOfDay: 9 * 60 + 29,
    domain: "INCIDENTS",
    text: "이화여대 정시 마감 D-2",
    tone: "err",
  },
  {
    id: "2",
    atIso: "x",
    hms: "13:45:00",
    minutesOfDay: 13 * 60 + 45,
    domain: "DEPLOY",
    text: "v4.2.1 배포 시작",
    tone: "warn",
  },
  {
    id: "3",
    atIso: "x",
    hms: "07:00:00",
    minutesOfDay: 7 * 60,
    domain: "SYS",
    text: "업무 전 이벤트",
    tone: "info",
  },
];

describe("ActivityTimeline", () => {
  it("renders header, hour axis, in-window events, NOW marker", () => {
    render(<ActivityTimeline entries={entries} />);
    expect(screen.getByText("실시간 운영 로그")).toBeInTheDocument();
    expect(screen.getByText("Live Activity Stream")).toBeInTheDocument();
    expect(screen.getByText("09")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("이화여대 정시 마감 D-2")).toBeInTheDocument();
    expect(screen.getByText("v4.2.1 배포 시작")).toBeInTheDocument();
    expect(screen.getByText("NOW")).toBeInTheDocument();
  });

  it("filters out-of-window events", () => {
    render(<ActivityTimeline entries={entries} />);
    expect(screen.queryByText("업무 전 이벤트")).not.toBeInTheDocument();
  });

  it("renders work-hours label", () => {
    render(<ActivityTimeline entries={[]} />);
    // 09:00–18:00 라벨은 항상 표시 (퇴근 카운트다운은 영업일에만)
    expect(screen.getByText(/09:00–18:00/)).toBeInTheDocument();
  });
});
