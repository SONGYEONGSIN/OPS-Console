import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShareControls } from "../ShareControls";

vi.mock("@/features/reports/actions", () => ({
  toggleReportShare: vi.fn(),
}));

describe("ShareControls", () => {
  it("토큰 없음 → '공유 링크 생성' 버튼", () => {
    render(<ShareControls reportId="r-1" initialToken={null} />);
    expect(screen.getByText(/공유 링크 생성/)).toBeInTheDocument();
  });

  it("토큰 있음 → 공유 URL + '해제' 버튼", () => {
    render(<ShareControls reportId="r-1" initialToken="tok-abc" />);
    expect(screen.getByText(/tok-abc/)).toBeInTheDocument();
    expect(screen.getByText(/해제/)).toBeInTheDocument();
  });
});
