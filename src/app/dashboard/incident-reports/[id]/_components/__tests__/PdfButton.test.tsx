import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { mockIssue } = vi.hoisted(() => ({ mockIssue: vi.fn() }));
vi.mock("@/features/incident-reports/actions", () => ({
  issueIncidentReportDocNumber: mockIssue,
}));

import { PdfButton } from "../PdfButton";

beforeEach(() => {
  vi.clearAllMocks();
  mockIssue.mockResolvedValue({ ok: true, docNumber: "운영2606-0202" });
});

describe("PdfButton", () => {
  it("클릭 시 발번 액션 호출 후 PDF 새 탭으로 오픈", async () => {
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);

    render(<PdfButton reportId="rep-1" />);
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));

    await waitFor(() => expect(mockIssue).toHaveBeenCalledWith("rep-1"));
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        "/api/incident-reports/rep-1/pdf",
        "_blank",
        "noopener,noreferrer",
      ),
    );
  });

  it("발번 실패해도 PDF는 열린다", async () => {
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    mockIssue.mockRejectedValueOnce(new Error("boom"));

    render(<PdfButton reportId="rep-2" />);
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));

    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        "/api/incident-reports/rep-2/pdf",
        "_blank",
        "noopener,noreferrer",
      ),
    );
  });
});
