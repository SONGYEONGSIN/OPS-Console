import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { blankDocument } from "@/features/quotes/document-schema";

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
});
