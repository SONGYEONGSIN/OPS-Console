import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportsList } from "../ReportsList";

describe("ReportsList — placeholder", () => {
  it("헤더 '저장된 리포트' + '+ 새 리포트' 버튼 표시", () => {
    render(<ReportsList />);
    expect(screen.getByText(/저장된 리포트/)).toBeInTheDocument();
    expect(screen.getByText(/새 리포트/)).toBeInTheDocument();
  });

  it("3 mock 리포트 항목 렌더", () => {
    render(<ReportsList />);
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
  });

  it("'+ 새 리포트' 버튼은 disabled (1차 placeholder)", () => {
    render(<ReportsList />);
    const btn = screen.getByText(/새 리포트/).closest("button");
    expect(btn).toBeDisabled();
  });
});
