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

  it("승인+발송가능 → compose에서 수신자 선택 후 발송(to_email + 팀장 자동 CC + 제목/본문)", async () => {
    mockSend.mockResolvedValue({ ok: true });
    const row: ListRow = {
      ...baseRow,
      incidentReportStatus: "approved",
      incidentReportCanSend: true,
      incidentReportAuthorName: "이해영",
      incidentReportAuthorEmail: "lee@x.com",
      incidentReportApproverName: "송영신",
      incidentReportApproverEmail: "song@x.com",
      incidentReportRecipients: [
        { email: "contact@univ.ac.kr", name: "김담당", jobTitle: "실무" },
      ],
    };
    render(<IncidentReportView row={row} />);
    // 초기 '발송' → compose 열기
    fireEvent.click(screen.getByRole("button", { name: "발송" }));
    // 수신자 검색 → 선택
    fireEvent.change(screen.getByLabelText("수신자 검색"), {
      target: { value: "김담당" },
    });
    fireEvent.click(screen.getByRole("button", { name: /김담당/ }));
    // 발송
    fireEvent.click(screen.getByRole("button", { name: "발송" }));
    await waitFor(() =>
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          id: row.id,
          to_email: "contact@univ.ac.kr",
          cc_emails: ["song@x.com"],
        }),
      ),
    );
    const arg = mockSend.mock.calls[0][0];
    expect(arg.subject).toContain("테스트 경위서");
    expect(arg.body).toContain("건국대학교");
  });
});
