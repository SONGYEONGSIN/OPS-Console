import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("groups nearby events into lead + (+N) and reveals all on click", () => {
    const clustered: ActivityLogEntry[] = [
      {
        id: "g1",
        atIso: "x",
        hms: "10:00:00",
        minutesOfDay: 10 * 60,
        domain: "NAV",
        text: "대표 이벤트",
        tone: "info",
      },
      {
        id: "g2",
        atIso: "x",
        hms: "10:10:00",
        minutesOfDay: 10 * 60 + 10,
        domain: "NAV",
        text: "멤버 이벤트 둘",
        tone: "info",
      },
      {
        id: "g3",
        atIso: "x",
        hms: "10:20:00",
        minutesOfDay: 10 * 60 + 20,
        domain: "NAV",
        text: "멤버 이벤트 셋",
        tone: "info",
      },
    ];
    render(<ActivityTimeline entries={clustered} />);
    // 대표 라벨 끝에 (+2). 멤버는 펼치기 전엔 미표시.
    const trigger = screen.getByText(/대표 이벤트 \(\+2\)/);
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByText("멤버 이벤트 둘")).not.toBeInTheDocument();
    // 클릭 → 팝오버에 멤버 전체 노출.
    fireEvent.click(trigger);
    expect(screen.getByText("멤버 이벤트 둘")).toBeInTheDocument();
    expect(screen.getByText("멤버 이벤트 셋")).toBeInTheDocument();
    // 재클릭 → 닫힘.
    fireEvent.click(trigger);
    expect(screen.queryByText("멤버 이벤트 둘")).not.toBeInTheDocument();
  });
});
