import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NewReportModal } from "../NewReportModal";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/reports/actions", () => ({
  createReport: vi.fn(),
}));

describe("NewReportModal", () => {
  it("open=false → 렌더 안 함", () => {
    render(<NewReportModal open={false} onClose={() => {}} />);
    expect(screen.queryByText(/새 리포트 생성/)).toBeNull();
  });

  it("open=true → 제목 input + 기간 select + 5 옵션", () => {
    render(<NewReportModal open={true} onClose={() => {}} />);
    expect(screen.getByText(/새 리포트 생성/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/예:/)).toBeInTheDocument();
    expect(screen.getByText("이번 달")).toBeInTheDocument();
    expect(screen.getByText("분기")).toBeInTheDocument();
  });

  it("취소 클릭 → onClose 호출", () => {
    const onClose = vi.fn();
    render(<NewReportModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("취소"));
    expect(onClose).toHaveBeenCalled();
  });

  it("title 빈 값 → 생성 버튼 disabled", () => {
    render(<NewReportModal open={true} onClose={() => {}} />);
    const submit = screen.getByText("생성");
    expect(submit).toBeDisabled();
  });
});
