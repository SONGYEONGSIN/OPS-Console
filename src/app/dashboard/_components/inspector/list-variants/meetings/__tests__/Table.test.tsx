import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { MeetingTable } from "../Table";

function makeRow(over: Partial<ListRow>): ListRow {
  return {
    id: crypto.randomUUID(),
    name: "회의",
    status: "active",
    owner: "",
    meetingType: "regular",
    meetingTitle: "회의 제목",
    meetingStatus: "draft",
    ...over,
  };
}

describe("MeetingTable", () => {
  it("유형 라벨·제목·상태 라벨을 렌더한다", () => {
    render(
      <MeetingTable
        rows={[
          makeRow({
            meetingType: "field",
            meetingTitle: "출장 보고서",
            meetingStatus: "draft",
            meetingAuthor: "홍길동",
          }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("외근·출장 보고")).toBeInTheDocument();
    expect(screen.getByText("출장 보고서")).toBeInTheDocument();
    expect(screen.getByText("작성중")).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
  });

  it("발송완료 상태 라벨을 렌더한다", () => {
    render(
      <MeetingTable
        rows={[makeRow({ meetingStatus: "sent" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("발송완료")).toBeInTheDocument();
  });

  it("행이 없으면 '데이터 없음'을 렌더한다", () => {
    render(<MeetingTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });
});
