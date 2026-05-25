import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NewReportButton } from "../NewReportButton";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/reports/actions", () => ({
  createReport: vi.fn(),
}));

describe("NewReportButton", () => {
  it("렌더 + 클릭 시 modal 노출", () => {
    render(<NewReportButton />);
    expect(screen.queryByText(/새 리포트 생성/)).toBeNull();
    fireEvent.click(screen.getByText("+ 새 리포트"));
    expect(screen.getByText(/새 리포트 생성/)).toBeInTheDocument();
  });
});
