import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  meetingLocation: "본사 3층 회의실",
  meetingAttendees: ["이해영", "송영신"],
  meetingContent: [
    { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "안건", styles: {} }] },
    { type: "paragraph", content: [{ type: "text", text: "예산 검토", styles: {} }] },
  ],
};

describe("MeetingView (회의내용/회의문서 2탭)", () => {
  it("두 탭을 노출하고 기본은 회의내용 탭", () => {
    render(<MeetingView row={row} />);
    expect(screen.getByRole("button", { name: "회의내용" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "회의문서" })).toBeInTheDocument();
    expect(screen.getByText("회의 정보")).toBeInTheDocument();
    expect(screen.getByText("본사 3층 회의실")).toBeInTheDocument();
    expect(screen.getByText("이해영, 송영신")).toBeInTheDocument();
    // 내용 블록 미리보기
    expect(screen.getByText("안건")).toBeInTheDocument();
    expect(screen.getByText("예산 검토")).toBeInTheDocument();
  });

  it("회의문서 탭은 경위서식(헤더 + 섹션 라벨/내용박스)으로 렌더한다", () => {
    render(<MeetingView row={row} />);
    fireEvent.click(screen.getByRole("button", { name: "회의문서" }));
    expect(screen.getAllByText(/월간 운영회의/).length).toBeGreaterThan(0);
    expect(screen.getByText(/정기회의/)).toBeInTheDocument();
    // 내용 헤딩이 섹션 라벨로, 본문이 내용박스로
    expect(screen.getByText("안건")).toBeInTheDocument();
    expect(screen.getByText("예산 검토")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /편집·PDF·메일 화면 열기/ }),
    ).toBeInTheDocument();
  });

  it("편집 화면으로 이동하는 링크를 제공한다", () => {
    render(<MeetingView row={row} />);
    const link = screen.getByRole("link", { name: /편집 화면 열기/ });
    expect(link).toHaveAttribute("href", "/dashboard/meetings/m-1");
  });
});
