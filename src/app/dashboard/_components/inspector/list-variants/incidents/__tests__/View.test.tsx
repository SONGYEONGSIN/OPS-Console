import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";

const { mockGetBundle, mockCreate } = vi.hoisted(() => ({
  mockGetBundle: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("@/features/incident-reports/report-bundle-action", () => ({
  getIncidentReportBundle: mockGetBundle,
}));
vi.mock("@/features/incident-reports/actions", () => ({
  createIncidentReport: mockCreate,
  // IncidentReportView가 import하는 액션들 (탭 안에서 재사용)
  submitForApproval: vi.fn(),
  approveIncidentReport: vi.fn(),
  rejectIncidentReport: vi.fn(),
}));
vi.mock("@/features/incident-reports/mail-actions", () => ({
  sendIncidentReport: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));

import { IncidentView } from "../View";

const INCIDENT_ID = "22222222-2222-4222-8222-222222222222";

const baseRow: ListRow = {
  id: INCIDENT_ID,
  name: "사고 A",
  status: "active",
  owner: "",
  incidentStatus: "처리중",
  incidentTitle: "사고 A",
  incidentUniversityName: "건국대학교",
  incidentCauseSummary: "경위 요약",
};

const EMPTY_BUNDLE = {
  report: null,
  recipients: [],
  approvalChain: null,
  isApprover: false,
  canSend: false,
};

beforeEach(() => vi.clearAllMocks());

describe("IncidentView 탭", () => {
  it("기본은 사고정보 탭 — 사고경위 노출", () => {
    render(<IncidentView row={baseRow} />);
    expect(screen.getByText("경위 요약")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "사고정보" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "경위서" })).toBeInTheDocument();
  });

  it("사고처리: handling_rows가 있으면 행으로 렌더한다", () => {
    render(
      <IncidentView
        row={{
          ...baseRow,
          incidentHandlingRows: [{ time: "06.02 14:27", content: "오류 확인" }],
        }}
      />,
    );
    expect(screen.getByText("06.02 14:27")).toBeInTheDocument();
    expect(screen.getByText("오류 확인")).toBeInTheDocument();
  });

  it("사고처리: 행이 없으면 레거시 resolution(text)으로 폴백한다", () => {
    render(
      <IncidentView
        row={{
          ...baseRow,
          incidentHandlingRows: [],
          incidentResolution: "레거시 처리 내용",
        }}
      />,
    );
    expect(screen.getByText("레거시 처리 내용")).toBeInTheDocument();
  });

  it("경위서 탭 진입 → 경위서 없음 안내 + 작성 버튼", async () => {
    mockGetBundle.mockResolvedValue(EMPTY_BUNDLE);
    render(<IncidentView row={baseRow} />);

    fireEvent.click(screen.getByRole("button", { name: "경위서" }));

    await waitFor(() =>
      expect(mockGetBundle).toHaveBeenCalledWith(INCIDENT_ID),
    );
    await waitFor(() =>
      expect(
        screen.getByText("이 사고에 연결된 경위서가 없습니다."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "경위서 작성" }),
    ).toBeInTheDocument();
  });

  it("경위서 작성 버튼 클릭 → createIncidentReport(incident_id) + 성공 시 refetch", async () => {
    mockGetBundle.mockResolvedValue(EMPTY_BUNDLE);
    mockCreate.mockResolvedValue({ ok: true, row: { id: "r1" } });
    render(<IncidentView row={baseRow} />);

    fireEvent.click(screen.getByRole("button", { name: "경위서" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "경위서 작성" }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "경위서 작성" }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({ incident_id: INCIDENT_ID }),
    );
    // 성공 시 번들 재조회 (최초 1 + create 후 1 = 2)
    await waitFor(() => expect(mockGetBundle).toHaveBeenCalledTimes(2));
  });

  it("경위서 작성 실패 → 인라인 에러", async () => {
    mockGetBundle.mockResolvedValue(EMPTY_BUNDLE);
    mockCreate.mockResolvedValue({ ok: false, error: "작성 실패" });
    render(<IncidentView row={baseRow} />);

    fireEvent.click(screen.getByRole("button", { name: "경위서" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "경위서 작성" }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "경위서 작성" }));
    await waitFor(() =>
      expect(screen.getByText("작성 실패")).toBeInTheDocument(),
    );
  });

  it("경위서 있음 → IncidentReportView 렌더 (제목 + 상태 라벨)", async () => {
    mockGetBundle.mockResolvedValue({
      report: {
        id: "r1",
        incident_id: INCIDENT_ID,
        recipient_university: "건국대학교",
        title: "연결된 경위서",
        draft_date: "2026-06-02",
        gyeongwi: "본문",
        cause: null,
        handling: null,
        prevention: null,
        apology: null,
        author_name: "홍길동",
        author_email: "me@x.com",
        approver_name: "팀장",
        approver_email: "l@x.com",
        director_name: null,
        ceo_name: null,
        status: "draft",
        reject_reason: null,
      },
      recipients: [],
      approvalChain: null,
      isApprover: false,
      canSend: false,
    });
    render(<IncidentView row={{ ...baseRow, incidentServiceName: "수시모집" }} />);

    fireEvent.click(screen.getByRole("button", { name: "경위서" }));

    // 작성중(draft)이면 제목·서비스명을 연결 사고의 현재값으로 라이브 미러
    // (report.title "연결된 경위서"가 아니라 사고 제목 "사고 A"가 보인다)
    await waitFor(() => expect(screen.getByText("사고 A")).toBeInTheDocument());
    expect(screen.queryByText("연결된 경위서")).not.toBeInTheDocument();
    expect(screen.getByText(/수시모집/)).toBeInTheDocument();
    expect(screen.getByText("작성중")).toBeInTheDocument();
  });
});
