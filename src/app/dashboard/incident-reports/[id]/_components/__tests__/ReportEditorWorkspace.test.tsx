import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { IncidentReportRow } from "@/features/incident-reports/schemas";

const { mockUpdate, mockRefresh } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockRefresh: vi.fn(),
}));
vi.mock("@/features/incident-reports/actions", () => ({
  updateIncidentReport: mockUpdate,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn(), back: vi.fn() }),
}));

import { ReportEditorWorkspace } from "../ReportEditorWorkspace";

const report: IncidentReportRow = {
  id: "11111111-1111-4111-8111-111111111111",
  incident_id: null,
  recipient_university: "건국대학교",
  title: "원서 오류",
  draft_date: "2026-06-02",
  gyeongwi: "초기 경위",
  cause: null,
  handling: null,
  prevention: null,
  apology: null,
  author_name: "이해영",
  author_email: "lee@example.com",
  approver_name: "송영신",
  approver_email: null,
  director_name: null,
  ceo_name: null,
  status: "draft",
  reject_reason: null,
  approved_at: null,
  recipient_emails: [],
  doc_number: null,
  created_at: "2026-06-02T00:00:00Z",
  updated_at: "2026-06-02T00:00:00Z",
};

beforeEach(() => vi.clearAllMocks());

describe("ReportEditorWorkspace", () => {
  it("경위 편집이 메인 뷰어(2페이지)에 즉시 반영된다", () => {
    render(<ReportEditorWorkspace report={report} />);
    fireEvent.change(screen.getByLabelText("경위"), {
      target: { value: "수정된 경위" },
    });
    fireEvent.click(screen.getByLabelText("다음 페이지"));
    const reflected = screen
      .getAllByText("수정된 경위")
      .filter((el) => el.tagName !== "TEXTAREA");
    expect(reflected.length).toBeGreaterThan(0);
  });

  it("페이지 넘기기: 기본 1페이지(공문), 다음 누르면 2페이지(경위서)", () => {
    render(<ReportEditorWorkspace report={report} />);
    expect(screen.getByText(/수신자/)).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("다음 페이지"));
    expect(screen.getByText("경 위 서")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("저장 시 편집값으로 updateIncidentReport를 호출한다", async () => {
    mockUpdate.mockResolvedValue({ ok: true });
    render(<ReportEditorWorkspace report={report} />);
    fireEvent.change(screen.getByLabelText("원인"), {
      target: { value: "새 원인" },
    });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        report.id,
        expect.objectContaining({ cause: "새 원인" }),
      ),
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("approved 상태면 편집 패널을 숨긴다", () => {
    render(<ReportEditorWorkspace report={{ ...report, status: "approved" }} />);
    expect(screen.queryByLabelText("경위")).not.toBeInTheDocument();
  });
});
