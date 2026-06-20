import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MeetingDocument } from "../MeetingDocument";

describe("MeetingDocument (좌측 문서 미리보기)", () => {
  const base = {
    title: "월간 운영회의",
    typeLabel: "정기회의",
    dateDisplay: "2026-06-19 14:00",
    location: "본사 3층",
    attendees: ["이해영", "송영신"],
    content: [
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "안건", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "예산 검토", styles: {} }],
      },
    ],
  };

  it("제목·유형·메타·내용을 문서 형태로 렌더한다", () => {
    render(<MeetingDocument {...base} />);
    expect(
      screen.getByRole("heading", { name: "월간 운영회의" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/정기회의 회의록/)).toBeInTheDocument();
    expect(screen.getByText("2026-06-19 14:00")).toBeInTheDocument();
    expect(screen.getByText("본사 3층")).toBeInTheDocument();
    expect(screen.getByText("이해영, 송영신")).toBeInTheDocument();
    expect(screen.getByText("안건")).toBeInTheDocument();
    expect(screen.getByText("예산 검토")).toBeInTheDocument();
  });

  it("내용이 없으면 안내 문구를 보인다", () => {
    render(<MeetingDocument {...base} content={[]} />);
    expect(screen.getByText("작성된 내용이 없습니다.")).toBeInTheDocument();
  });
});
