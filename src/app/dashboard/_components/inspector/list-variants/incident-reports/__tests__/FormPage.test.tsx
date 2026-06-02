import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
  authorEmail: "haelee@jinhakapply.com",
  approverName: "송영신",
  directorName: "이이화",
  ceoName: "주정현",
  docNumber: null,
  apology: null,
  gyeongwi: "경위 내용입니다",
  cause: "원인 내용입니다",
  handling: "처리 텍스트 폴백",
  handlingRows: [],
  prevention: "대책 내용입니다",
};
const model = deriveFormModel(source);

describe("FormPage page 1 (공문)", () => {
  it("수신대학·제목·결재자 한 줄(담당자/팀장/본부장/사장)을 렌더한다", () => {
    render(<FormPage model={model} page={1} />);
    expect(screen.getByText(/수신자/)).toBeInTheDocument();
    expect(screen.getAllByText(/전산파일 오류 건/).length).toBeGreaterThan(0);
    expect(screen.getByText("담당자")).toBeInTheDocument();
    expect(screen.getByText("팀장")).toBeInTheDocument();
    expect(screen.getByText("본부장")).toBeInTheDocument();
    expect(screen.getByText("사장")).toBeInTheDocument();
  });
  it("회사명과 직인 이미지를 렌더한다", () => {
    render(<FormPage model={model} page={1} />);
    expect(screen.getByText(/진학어플라이 대표이사/)).toBeInTheDocument();
    expect(screen.getByAltText("직인")).toBeInTheDocument();
  });
  it("연락처에 작성자 이메일이 나온다", () => {
    render(<FormPage model={model} page={1} />);
    expect(screen.getByText(/haelee@jinhakapply\.com/)).toBeInTheDocument();
  });
  it("인사말이 한 번만 나온다 (중복 없음)", () => {
    render(<FormPage model={model} page={1} />);
    expect(screen.getAllByText(/무궁한 발전을 기원합니다/).length).toBe(1);
  });
});

describe("FormPage page 2 (경위서)", () => {
  it("4섹션 + 맺음말을 렌더한다", () => {
    render(<FormPage model={model} page={2} />);
    expect(screen.getByText("경 위 서")).toBeInTheDocument();
    expect(screen.getByText("경위 내용입니다")).toBeInTheDocument();
    expect(screen.getByText("원인 내용입니다")).toBeInTheDocument();
    expect(screen.getByText("대책 내용입니다")).toBeInTheDocument();
  });
  it("handlingRows가 없으면 3.처리를 text로 렌더한다", () => {
    render(<FormPage model={model} page={2} />);
    expect(screen.getByText("처리 텍스트 폴백")).toBeInTheDocument();
  });
  it("handlingRows가 있으면 3.처리를 시간/내용 2열 표로 렌더한다", () => {
    const m = deriveFormModel({
      ...source,
      handlingRows: [
        { time: "09.27 14:27", content: "오류 확인 요청" },
        { time: "09.27 15:20", content: "완료 피드백" },
      ],
    });
    render(<FormPage model={m} page={2} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("시간")).toBeInTheDocument();
    expect(within(table).getByText("내용")).toBeInTheDocument();
    expect(within(table).getByText("09.27 14:27")).toBeInTheDocument();
    expect(within(table).getByText("오류 확인 요청")).toBeInTheDocument();
    expect(within(table).getByText("완료 피드백")).toBeInTheDocument();
    // 표가 있으면 폴백 text는 안 보인다
    expect(screen.queryByText("처리 텍스트 폴백")).not.toBeInTheDocument();
  });
});
