import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { blankDocument, QUOTE_TYPE_LABELS } from "@/features/quotes/document-schema";

const { mockSave } = vi.hoisted(() => ({
  mockSave: vi.fn(),
}));

vi.mock("@/features/quotes/document-actions", () => ({
  saveQuoteDocument: mockSave,
}));

import { QuoteDocumentEditor } from "../QuoteDocumentEditor";

beforeEach(() => {
  vi.clearAllMocks();
  mockSave.mockResolvedValue({ ok: true });
});

function renderEditor(type: Parameters<typeof blankDocument>[0] = "dev") {
  return render(
    <QuoteDocumentEditor
      id="q-1"
      quoteType={type}
      document={blankDocument(type)}
      customer="테스트 대학"
      onSave={mockSave}
    />,
  );
}

describe("QuoteDocumentEditor", () => {
  it("최상단에 견적서 타이틀을 표시한다", () => {
    renderEditor();
    expect(screen.getByRole("heading", { name: "견적서" })).toBeInTheDocument();
  });

  it("공통 헤더 좌측 필드 라벨(수신·견적명·접수인원·견적비용·결제조건)을 표시한다", () => {
    renderEditor();
    expect(screen.getByText("수신")).toBeInTheDocument();
    expect(screen.getByText("견적명")).toBeInTheDocument();
    expect(screen.getByText("접수인원")).toBeInTheDocument();
    expect(screen.getByText("견적비용")).toBeInTheDocument();
    expect(screen.getByText("결제조건")).toBeInTheDocument();
  });

  it("공통 헤더 우측 발신자 상수(법인명·등록번호·주소)를 읽기전용으로 표시한다", () => {
    renderEditor();
    expect(screen.getByText("주식회사 진학어플라이")).toBeInTheDocument();
    expect(screen.getByText("101-86-62676")).toBeInTheDocument();
    expect(
      screen.getByText("서울 종로구 경희궁길 34 진학기획빌딩"),
    ).toBeInTheDocument();
  });

  it("담당자 연락처(전화·이메일) 입력 필드를 제공한다", () => {
    renderEditor();
    expect(screen.getByLabelText("담당자 전화")).toBeInTheDocument();
    expect(screen.getByLabelText("담당자 이메일")).toBeInTheDocument();
  });

  it("4개 섹션 제목을 모두 표시한다", () => {
    renderEditor();
    expect(
      screen.getByText("1. 시스템(인프라·장비) 이용"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("2. 인건비 (직접인건비·제경비·기술료)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("3. 외주비/비용 (장비·실비·수수료)"),
    ).toBeInTheDocument();
    expect(screen.getByText("4. 총 비용 및 단가 산출")).toBeInTheDocument();
  });

  it("각 섹션에 문구 textarea를 제공한다", () => {
    renderEditor();
    const notes = screen.getAllByPlaceholderText("이 항목 관련 문구/설명");
    expect(notes).toHaveLength(4);
  });

  it("최하단 안내사항(guide) 섹션 제목을 표시한다", () => {
    renderEditor();
    expect(
      screen.getByText("산출 근거 및 주의 안내사항"),
    ).toBeInTheDocument();
  });

  it("안내사항 라인을 추가할 수 있다", () => {
    renderEditor();
    fireEvent.click(screen.getByText("+ 안내 추가"));
    expect(
      screen.getByPlaceholderText("안내 내용 입력"),
    ).toBeInTheDocument();
  });

  it("유형 선택기가 렌더되며 현재 quoteType 값이 선택되어 있다", () => {
    renderEditor();
    const select = screen.getByRole("combobox", { name: /견적서 유형/ });
    expect(select).toBeInTheDocument();
    expect((select as HTMLSelectElement).value).toBe("dev");
    expect(screen.getByText(QUOTE_TYPE_LABELS["dev"])).toBeInTheDocument();
    expect(screen.getByText(QUOTE_TYPE_LABELS["platform"])).toBeInTheDocument();
  });

  it("system 섹션 행 추가 후 수량·기간·단가 입력 시 금액이 자동계산된다", () => {
    renderEditor();
    // system 섹션 표에 행 추가 (첫 + 행 추가 버튼)
    const addButtons = screen.getAllByText("+ 행 추가");
    fireEvent.click(addButtons[0]);
    // 수량 2 × 기간 3 × 단가 10000 = 60000
    const qty = screen.getByLabelText("수량");
    const months = screen.getByLabelText("기간(월)");
    const unit = screen.getByLabelText("단가(원/월)");
    fireEvent.change(qty, { target: { value: "2" } });
    fireEvent.change(months, { target: { value: "3" } });
    fireEvent.change(unit, { target: { value: "10000" } });
    // 자동계산 금액 표시(읽기전용 셀)
    expect(screen.getByText("60,000")).toBeInTheDocument();
  });

  describe("labor 섹션 에디터", () => {
    it("요율 입력이 렌더되고, 행 추가 후 등급 드롭다운 선택 시 단가가 채워진다", () => {
      renderEditor("labor");
      expect(screen.getByLabelText("제경비율")).toBeInTheDocument();
      expect(screen.getByLabelText("기술료율")).toBeInTheDocument();

      // labor 섹션은 두번째 섹션 → + 행 추가 버튼 인덱스 1
      const addButtons = screen.getAllByText("+ 행 추가");
      fireEvent.click(addButtons[1]);
      const gradeSelect = screen.getByRole("combobox", { name: /등급 선택/ });
      expect(gradeSelect).toBeInTheDocument();

      fireEvent.change(gradeSelect, { target: { value: "planner" } });
      expect(screen.getByDisplayValue("578206")).toBeInTheDocument();
    });
  });

  it("저장 버튼 클릭 시 onSave를 현재 문서로 호출한다", async () => {
    renderEditor();
    fireEvent.click(screen.getByText("저장"));
    await vi.waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });
    expect(mockSave.mock.calls[0][0]).toBe("q-1");
    expect(mockSave.mock.calls[0][2]).toBe("dev");
  });
});
