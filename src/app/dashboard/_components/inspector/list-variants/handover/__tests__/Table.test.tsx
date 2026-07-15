import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoverTable } from "../Table";
import type { ListRow } from "../../../../patterns/ListPattern";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const baseRow: ListRow = {
  id: "aaaaaaaa-1111-4111-8111-111111111111",
  name: "서울대학교 · 수시",
  status: "active",
  owner: "송영신",
  universityName: "서울대학교",
  serviceName: "수시 일반전형",
  applicationType: "공통원서",
  handoverStatus: "ready",
};

describe("HandoverTable", () => {
  it("빈 rows → '데이터 없음'", () => {
    render(<HandoverTable rows={[]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });

  it("대학명·서비스/운영자/구분/작성상태 컬럼 표시", () => {
    render(
      <HandoverTable rows={[baseRow]} selectedId={null} onSelect={() => {}} />,
    );
    expect(screen.getByText("서울대학교")).toBeInTheDocument();
    expect(screen.getByText(/수시 일반전형/)).toBeInTheDocument();
    expect(screen.getByText("송영신")).toBeInTheDocument();
    expect(screen.getByText("공통원서")).toBeInTheDocument();
    expect(screen.getByText("작성완료")).toBeInTheDocument();
  });

  it("status 없음 → '미작성'", () => {
    render(
      <HandoverTable
        rows={[{ ...baseRow, handoverStatus: undefined }]}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("미작성")).toBeInTheDocument();
  });

  it("row 클릭 → 전용 작성 편집기 페이지로 이동", () => {
    pushMock.mockReset();
    render(
      <HandoverTable rows={[baseRow]} selectedId={null} onSelect={() => {}} />,
    );
    fireEvent.click(screen.getByText("서울대학교").closest("tr")!);
    expect(pushMock).toHaveBeenCalledWith(`/dashboard/handover/${baseRow.id}`);
  });
});
