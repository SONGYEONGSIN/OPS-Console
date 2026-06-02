import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { FormPreview } from "../FormPreview";
import { DEFAULT_APOLOGY } from "@/features/incident-reports/form-content";

const row: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "전산파일 오류 건",
  owner: "이해영",
  status: "active",
  incidentReportUniversity: "건국대학교",
  incidentReportTitle: "전산파일 오류 건",
  incidentReportDraftDate: "2026-06-02",
  incidentReportAuthorName: "이해영",
  incidentReportApproverName: "송영신",
  incidentReportGyeongwi: "경위 내용입니다",
  incidentReportCause: "원인 내용입니다",
  incidentReportHandling: "처리 내용입니다",
  incidentReportPrevention: "대책 내용입니다",
  incidentReportApology: null,
};

describe("FormPreview", () => {
  it("수신대학·제목·인사말을 공문에 렌더한다", () => {
    render(<FormPreview row={row} />);
    expect(screen.getAllByText(/건국대학교/).length).toBeGreaterThan(0);
    expect(
      screen.getByText("건국대학교의 무궁한 발전을 기원합니다."),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/전산파일 오류 건/).length).toBeGreaterThan(0);
  });

  it("4섹션 본문을 모두 렌더한다", () => {
    render(<FormPreview row={row} />);
    expect(screen.getByText("경위 내용입니다")).toBeInTheDocument();
    expect(screen.getByText("원인 내용입니다")).toBeInTheDocument();
    expect(screen.getByText("처리 내용입니다")).toBeInTheDocument();
    expect(screen.getByText("대책 내용입니다")).toBeInTheDocument();
  });

  it("apology 미입력 시 기본 사과 문구를 보인다", () => {
    render(<FormPreview row={row} />);
    expect(screen.getByText(DEFAULT_APOLOGY)).toBeInTheDocument();
  });

  it("결재라인 4칸을 보인다", () => {
    render(<FormPreview row={row} />);
    expect(screen.getByText("담당자")).toBeInTheDocument();
    expect(screen.getByText("팀장")).toBeInTheDocument();
    expect(screen.getByText("본부장")).toBeInTheDocument();
    expect(screen.getByText("사장")).toBeInTheDocument();
  });
});
