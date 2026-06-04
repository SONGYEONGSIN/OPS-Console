import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import type { IncidentReportRow } from "@/features/incident-reports/schemas";

const { mockUpdate, mockRefresh, mockRevoke, mockUpdateIncident } = vi.hoisted(
  () => ({
    mockUpdate: vi.fn(),
    mockRefresh: vi.fn(),
    mockRevoke: vi.fn(),
    mockUpdateIncident: vi.fn(),
  }),
);
vi.mock("@/features/incident-reports/actions", () => ({
  updateIncidentReport: mockUpdate,
  revokeApproval: mockRevoke,
}));
vi.mock("@/features/incidents/actions", () => ({
  updateIncident: mockUpdateIncident,
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
  handling_rows: [],
  prevention: null,
  apology: null,
  author_name: "이해영",
  author_email: "lee@example.com",
  approver_name: "송영신",
  approver_email: null,
  approver_role: "팀장",
  director_name: null,
  director_role: null,
  ceo_name: null,
  ceo_role: null,
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

  it("수신대학은 편집 불가(읽기전용), 서비스명은 props로 표시", () => {
    render(<ReportEditorWorkspace report={report} serviceName="수시모집" />);
    // 수신대학 편집 input 없음
    expect(screen.queryByLabelText("수신대학")).not.toBeInTheDocument();
    // 서비스명 읽기전용 표시
    expect(screen.getByText("수시모집")).toBeInTheDocument();
    expect(screen.getByText(/사고에서 동기화/)).toBeInTheDocument();
  });

  it("페이지 넘기기: 기본 1페이지(공문), 다음 누르면 2페이지(경위서)", () => {
    render(<ReportEditorWorkspace report={report} />);
    expect(screen.getByText(/수신자/)).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("다음 페이지"));
    expect(screen.getByText("경 위 서")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("사고 미연결 저장 시 공유 필드를 updateIncidentReport로 저장한다", async () => {
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

  it("사고 연결 시 공유 필드는 updateIncident(사고), 고유 필드는 updateIncidentReport(경위서)로 분리 저장한다", async () => {
    mockUpdate.mockResolvedValue({ ok: true });
    mockUpdateIncident.mockResolvedValue({ ok: true });
    const linked: IncidentReportRow = {
      ...report,
      incident_id: "22222222-2222-4222-8222-222222222222",
    };
    render(<ReportEditorWorkspace report={linked} />);
    fireEvent.change(screen.getByLabelText("원인"), {
      target: { value: "새 원인" },
    });
    fireEvent.change(screen.getByLabelText("사과 본문"), {
      target: { value: "새 사과문" },
    });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    // 공유 필드(원인→root_cause)는 사고로
    await waitFor(() =>
      expect(mockUpdateIncident).toHaveBeenCalledWith(
        linked.incident_id,
        expect.objectContaining({ root_cause: "새 원인" }),
      ),
    );
    // 고유 필드(사과문)는 경위서로 — 공유 필드(cause)는 경위서 패치에 미포함
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        linked.id,
        expect.objectContaining({ apology: "새 사과문" }),
      ),
    );
    const reportPatch = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(reportPatch).not.toHaveProperty("cause");
    expect(reportPatch).not.toHaveProperty("handling_rows");
    expect(reportPatch).not.toHaveProperty("title");
  });

  it("제목은 편집 불가(읽기전용) — 사고에서 동기화", () => {
    render(<ReportEditorWorkspace report={report} />);
    expect(screen.queryByLabelText("제목")).not.toBeInTheDocument();
    expect(
      screen.getByText("(사고에서 동기화 · 수정 불가)"),
    ).toBeInTheDocument();
  });

  it("approved 상태면 편집 패널을 숨긴다", () => {
    render(
      <ReportEditorWorkspace report={{ ...report, status: "approved" }} />,
    );
    expect(screen.queryByLabelText("경위")).not.toBeInTheDocument();
  });

  it("approved + 권한 있으면 '승인 취소' 버튼이 보이고 클릭 시 revokeApproval 호출", async () => {
    mockRevoke.mockResolvedValue({ ok: true });
    render(
      <ReportEditorWorkspace
        report={{ ...report, status: "approved" }}
        canManageApproval
      />,
    );
    const btn = screen.getByRole("button", { name: /승인 취소/ });
    fireEvent.click(btn);
    await waitFor(() => expect(mockRevoke).toHaveBeenCalledWith(report.id));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("approved 라도 권한 없으면 '승인 취소' 버튼이 없다", () => {
    render(
      <ReportEditorWorkspace report={{ ...report, status: "approved" }} />,
    );
    expect(
      screen.queryByRole("button", { name: /승인 취소/ }),
    ).not.toBeInTheDocument();
  });

  it("처리 행을 추가·입력하면 2페이지 표에 반영되고 저장에 포함된다", async () => {
    mockUpdate.mockResolvedValue({ ok: true });
    render(<ReportEditorWorkspace report={report} />);
    fireEvent.click(screen.getByRole("button", { name: "+ 처리 행 추가" }));
    fireEvent.change(screen.getByLabelText("처리 시간 1"), {
      target: { value: "09.27 14:27" },
    });
    fireEvent.change(screen.getByLabelText("처리 내용 1"), {
      target: { value: "오류 확인 요청" },
    });
    // 2페이지(경위서)에 표로 반영
    fireEvent.click(screen.getByLabelText("다음 페이지"));
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    // 표 셀에 반영 (편집 textarea 값과 구분해 표 범위로 한정)
    expect(within(table).getByText("오류 확인 요청")).toBeInTheDocument();
    // 저장 시 handling_rows 포함
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        report.id,
        expect.objectContaining({
          handling_rows: [{ time: "09.27 14:27", content: "오류 확인 요청" }],
        }),
      ),
    );
  });
});
