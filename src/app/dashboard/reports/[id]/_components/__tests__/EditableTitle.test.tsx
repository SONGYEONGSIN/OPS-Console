import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditableTitle } from "../EditableTitle";
import { updateReportTitle } from "@/features/reports/actions";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));
vi.mock("@/features/reports/actions", () => ({
  updateReportTitle: vi.fn(),
}));

const ID = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditableTitle", () => {
  it("초기: 제목 + '수정' 버튼", () => {
    render(<EditableTitle reportId={ID} initialTitle="오타 제목" />);
    expect(screen.getByText("오타 제목")).toBeInTheDocument();
    expect(screen.getByLabelText("제목 수정")).toBeInTheDocument();
  });

  it("수정 클릭 → input(현재 제목) + 저장/취소", () => {
    render(<EditableTitle reportId={ID} initialTitle="오타 제목" />);
    fireEvent.click(screen.getByLabelText("제목 수정"));
    const input = screen.getByDisplayValue("오타 제목");
    expect(input).toBeInTheDocument();
    expect(screen.getByText("저장")).toBeInTheDocument();
    expect(screen.getByText("취소")).toBeInTheDocument();
  });

  it("저장 → updateReportTitle 호출 + 성공 시 refresh + 뷰 복귀", async () => {
    vi.mocked(updateReportTitle).mockResolvedValue({ ok: true, id: ID });
    render(<EditableTitle reportId={ID} initialTitle="오타 제목" />);
    fireEvent.click(screen.getByLabelText("제목 수정"));
    const input = screen.getByDisplayValue("오타 제목");
    fireEvent.change(input, { target: { value: "고친 제목" } });
    fireEvent.click(screen.getByText("저장"));

    await waitFor(() =>
      expect(updateReportTitle).toHaveBeenCalledWith({
        id: ID,
        title: "고친 제목",
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("빈 제목 저장 → 액션 미호출 + 에러 표시", () => {
    render(<EditableTitle reportId={ID} initialTitle="오타 제목" />);
    fireEvent.click(screen.getByLabelText("제목 수정"));
    const input = screen.getByDisplayValue("오타 제목");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByText("저장"));
    expect(updateReportTitle).not.toHaveBeenCalled();
    expect(screen.getByText(/제목을 입력하세요/)).toBeInTheDocument();
  });

  it("취소 → 뷰 모드로 복귀 (액션 미호출)", () => {
    render(<EditableTitle reportId={ID} initialTitle="오타 제목" />);
    fireEvent.click(screen.getByLabelText("제목 수정"));
    fireEvent.click(screen.getByText("취소"));
    expect(screen.getByLabelText("제목 수정")).toBeInTheDocument();
    expect(updateReportTitle).not.toHaveBeenCalled();
  });
});
