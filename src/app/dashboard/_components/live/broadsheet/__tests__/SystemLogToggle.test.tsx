import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SystemLogToggle } from "../SystemLogToggle";
import type { ActivityLogEntry } from "../activity-log";

const entries: ActivityLogEntry[] = [
  {
    id: "1",
    atIso: "2026-06-13T10:00:00+09:00",
    hms: "10:00:00",
    minutesOfDay: 600,
    domain: "INCIDENTS",
    text: "사고 접수",
    tone: "warn",
  },
  {
    id: "2",
    atIso: "2026-06-13T10:05:00+09:00",
    hms: "10:05:00",
    minutesOfDay: 605,
    domain: "NAV",
    text: "페이지 진입",
    tone: "info",
  },
];

describe("SystemLogToggle", () => {
  it("토글 버튼 '시스템 로그'를 렌더", () => {
    render(<SystemLogToggle entries={entries} />);
    expect(screen.getByText("시스템 로그")).toBeInTheDocument();
  });

  it("클릭 전에는 패널 내용이 표시되지 않음", () => {
    render(<SystemLogToggle entries={entries} />);
    expect(screen.queryByText("10:00:00")).not.toBeInTheDocument();
    expect(screen.queryByText("[INCIDENTS]")).not.toBeInTheDocument();
  });

  it("토글 클릭 후 hms / [DOMAIN] / text 표시", () => {
    render(<SystemLogToggle entries={entries} />);
    fireEvent.click(screen.getByText("시스템 로그"));
    expect(screen.getByText("10:00:00")).toBeInTheDocument();
    expect(screen.getByText("[INCIDENTS]")).toBeInTheDocument();
    expect(screen.getByText(/사고 접수/)).toBeInTheDocument();
    expect(screen.getByText("10:05:00")).toBeInTheDocument();
    expect(screen.getByText("[NAV]")).toBeInTheDocument();
  });

  it("entries가 비어있으면 '활동 없음' placeholder 표시", () => {
    render(<SystemLogToggle entries={[]} />);
    fireEvent.click(screen.getByText("시스템 로그"));
    expect(screen.getByText("활동 없음")).toBeInTheDocument();
  });
});
