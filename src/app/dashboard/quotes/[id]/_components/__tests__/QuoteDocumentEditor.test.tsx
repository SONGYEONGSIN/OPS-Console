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

describe("QuoteDocumentEditor", () => {
  it("마스트헤드 6개 필드 라벨과 발신자 회사명을 표시한다", () => {
    render(
      <QuoteDocumentEditor
        id="q-1"
        quoteType="dev"
        document={blankDocument("dev")}
        customer="테스트 대학"
        onSave={mockSave}
      />,
    );
    expect(screen.getByText("수신")).toBeInTheDocument();
    expect(screen.getByText("견적명")).toBeInTheDocument();
    expect(screen.getByText("견적번호")).toBeInTheDocument();
    expect(screen.getByText("주식회사 진학어플라이")).toBeInTheDocument();
  });

  it("섹션 표 컬럼 헤더(구분·상세내역·비고·비용)를 표시한다", () => {
    render(
      <QuoteDocumentEditor
        id="q-1"
        quoteType="dev"
        document={blankDocument("dev")}
        customer="테스트 대학"
        onSave={mockSave}
      />,
    );
    expect(screen.getByText("구분")).toBeInTheDocument();
    expect(screen.getByText("상세내역")).toBeInTheDocument();
    expect(screen.getByText("비용")).toBeInTheDocument();
  });

  it("합계 영역(공급가·부가세·합계) 레이블을 표시한다", () => {
    render(
      <QuoteDocumentEditor
        id="q-1"
        quoteType="dev"
        document={blankDocument("dev")}
        customer="테스트 대학"
        onSave={mockSave}
      />,
    );
    expect(screen.getByText("공급가액")).toBeInTheDocument();
    expect(screen.getByText("부가세")).toBeInTheDocument();
    expect(screen.getByText("합계")).toBeInTheDocument();
  });

  it("유형 선택기가 렌더되며 현재 quoteType 값이 선택되어 있다", () => {
    render(
      <QuoteDocumentEditor
        id="q-1"
        quoteType="dev"
        document={blankDocument("dev")}
        customer="테스트 대학"
        onSave={mockSave}
      />,
    );
    const select = screen.getByRole("combobox", { name: /견적서 유형/ });
    expect(select).toBeInTheDocument();
    expect((select as HTMLSelectElement).value).toBe("dev");
    // 모든 유형 옵션이 있는지 확인
    expect(screen.getByText(QUOTE_TYPE_LABELS["dev"])).toBeInTheDocument();
    expect(screen.getByText(QUOTE_TYPE_LABELS["platform"])).toBeInTheDocument();
  });

  it("빈 문서에서 platform 선택 시 platform 6열 컬럼으로 교체된다", () => {
    render(
      <QuoteDocumentEditor
        id="q-1"
        quoteType="dev"
        document={blankDocument("dev")}
        customer="테스트 대학"
        onSave={mockSave}
      />,
    );
    const select = screen.getByRole("combobox", { name: /견적서 유형/ });
    fireEvent.change(select, { target: { value: "platform" } });
    // platform 컬럼: 세부서비스·기능명세 등장
    expect(screen.getByText("세부서비스")).toBeInTheDocument();
    expect(screen.getByText("기능명세")).toBeInTheDocument();
    // dev 전용 컬럼 '상세내역'은 사라짐
    expect(screen.queryByText("상세내역")).not.toBeInTheDocument();
  });
});
