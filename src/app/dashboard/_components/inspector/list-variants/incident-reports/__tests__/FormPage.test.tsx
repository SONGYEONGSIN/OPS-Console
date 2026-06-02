import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormPage } from "../FormPage";
import {
  deriveFormModel,
  type FormSource,
} from "@/features/incident-reports/form-content";

const source: FormSource = {
  recipientUniversity: "건국대학교",
  title: "전산파일 오류 건",
  draftDate: "2026-06-02",
  authorName: "이해영",
  approverName: "송영신",
  directorName: null,
  ceoName: null,
  docNumber: null,
  apology: null,
  gyeongwi: "경위 내용입니다",
  cause: "원인 내용입니다",
  handling: "처리 내용입니다",
  prevention: "대책 내용입니다",
};
const model = deriveFormModel(source);

describe("FormPage", () => {
  it("page=1: 공문(수신대학·제목·결재라인)을 렌더한다", () => {
    render(<FormPage model={model} page={1} />);
    expect(screen.getByText(/수신자/)).toBeInTheDocument();
    expect(screen.getAllByText(/전산파일 오류 건/).length).toBeGreaterThan(0);
    expect(screen.getByText("담당자")).toBeInTheDocument();
    expect(screen.getByText("사장")).toBeInTheDocument();
  });

  it("page=1: 인사말이 정확히 한 번만 나온다 (중복 없음)", () => {
    render(<FormPage model={model} page={1} />);
    expect(screen.getAllByText(/무궁한 발전을 기원합니다/).length).toBe(1);
  });

  it("page=2: 경위서 4섹션 본문을 렌더한다", () => {
    render(<FormPage model={model} page={2} />);
    expect(screen.getByText("경 위 서")).toBeInTheDocument();
    expect(screen.getByText("경위 내용입니다")).toBeInTheDocument();
    expect(screen.getByText("원인 내용입니다")).toBeInTheDocument();
    expect(screen.getByText("처리 내용입니다")).toBeInTheDocument();
    expect(screen.getByText("대책 내용입니다")).toBeInTheDocument();
  });
});
