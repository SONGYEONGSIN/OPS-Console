import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";

const { mockSubmit, mockApprove, mockReject, mockSend, mockPush } = vi.hoisted(
  () => ({
    mockSubmit: vi.fn(),
    mockApprove: vi.fn(),
    mockReject: vi.fn(),
    mockSend: vi.fn(),
    mockPush: vi.fn(),
  }),
);

vi.mock("@/features/incident-reports/actions", () => ({
  submitForApproval: mockSubmit,
  approveIncidentReport: mockApprove,
  rejectIncidentReport: mockReject,
}));
vi.mock("@/features/incident-reports/mail-actions", () => ({
  sendIncidentReport: mockSend,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn(), back: vi.fn() }),
}));

import { IncidentReportView } from "../View";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "테스트 경위서",
  status: "active",
  owner: "홍길동",
  incidentReportStatus: "draft",
  incidentReportTitle: "테스트 경위서",
  incidentReportUniversity: "건국대학교",
};

beforeEach(() => vi.clearAllMocks());

describe("IncidentReportView onChanged", () => {
  it("승인 요청 성공 시 onChanged 호출", async () => {
    mockSubmit.mockResolvedValue({ ok: true });
    const onChanged = vi.fn();
    render(<IncidentReportView row={baseRow} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole("button", { name: /승인 요청/ }));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith(baseRow.id));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("액션 실패 시 onChanged 미호출", async () => {
    mockSubmit.mockResolvedValue({ ok: false, error: "실패" });
    const onChanged = vi.fn();
    render(<IncidentReportView row={baseRow} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole("button", { name: /승인 요청/ }));

    await waitFor(() => expect(screen.getByText("실패")).toBeInTheDocument());
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("onChanged 미전달 시에도 동작 (기존 호환)", async () => {
    mockSubmit.mockResolvedValue({ ok: true });
    render(<IncidentReportView row={baseRow} />);

    fireEvent.click(screen.getByRole("button", { name: /승인 요청/ }));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith(baseRow.id));
  });

  it("'경위서 내용 보기' 클릭 시 편집 워크스페이스로 이동한다", () => {
    render(<IncidentReportView row={baseRow} />);
    fireEvent.click(screen.getByRole("button", { name: /경위서 내용 보기/ }));
    expect(mockPush).toHaveBeenCalledWith(
      `/dashboard/incident-reports/${baseRow.id}`,
    );
  });
});
