import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PricingSheet } from "../PricingSheet";
import type { PricingSheetParsed } from "@/features/assignments/pricing-parse";

const CATEGORY_BUTTON_LABELS = ["원서접수", "PIMS", "입학상담앱"];

const parsed: PricingSheetParsed = {
  원서접수: [
    {
      category: "원서접수",
      title: "서비스 제공 기준",
      subtitle: "VAT 포함",
      rows: [
        ["구분", "단가"],
        ["기본접수", "1,000원"],
      ],
      notes: ["* 별도 비용 없음"],
    },
    {
      category: "원서접수",
      title: "전형료별 수수료",
      rows: [["전형료", "수수료"]],
      notes: [],
    },
  ],
  PIMS: [
    {
      category: "PIMS",
      title: "서비스 제공 기준",
      rows: [["기본 서비스", "3,500만원"]],
      notes: [],
    },
  ],
  입학상담앱: [
    {
      category: "입학상담앱",
      title: "입학상담앱",
      rows: [["2/4년제", "1,200만원"]],
      notes: [],
    },
  ],
};

describe("PricingSheet", () => {
  it("3개 탭 버튼(원서접수/PIMS/입학상담앱)을 노출하고 각 카테고리 섹션 카운트 표시", () => {
    render(<PricingSheet parsed={parsed} />);
    expect(screen.getByRole("button", { name: /원서접수/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PIMS/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /입학상담앱/ }),
    ).toBeInTheDocument();
    // 원서접수(2), PIMS(1), 입학상담앱(1)
    expect(screen.getByText("(2)")).toBeInTheDocument();
    expect(screen.getAllByText("(1)")).toHaveLength(2);
  });

  it("기본 활성 탭은 원서접수 — 원서접수 섹션의 셀이 노출", () => {
    render(<PricingSheet parsed={parsed} />);
    expect(screen.getByText("서비스 제공 기준")).toBeInTheDocument();
    expect(screen.getByText("기본접수")).toBeInTheDocument();
    // PIMS 섹션 본문은 미노출
    expect(screen.queryByText("3,500만원")).not.toBeInTheDocument();
  });

  it("PIMS 탭 클릭 시 PIMS 섹션이 노출되고 원서접수 본문은 사라짐", () => {
    render(<PricingSheet parsed={parsed} />);
    fireEvent.click(screen.getByRole("button", { name: /PIMS/ }));
    expect(screen.getByText("3,500만원")).toBeInTheDocument();
    expect(screen.queryByText("기본접수")).not.toBeInTheDocument();
  });

  it("입학상담앱 탭 클릭 시 입학상담앱 섹션이 노출", () => {
    render(<PricingSheet parsed={parsed} />);
    fireEvent.click(screen.getByRole("button", { name: /입학상담앱/ }));
    expect(screen.getByText("1,200만원")).toBeInTheDocument();
    expect(screen.getByText("2/4년제")).toBeInTheDocument();
  });

  it("모든 카테고리가 비어 있으면 안내 문구 렌더", () => {
    render(
      <PricingSheet parsed={{ 원서접수: [], PIMS: [], 입학상담앱: [] }} />,
    );
    expect(screen.getByText(/가격정책 데이터가 없습니다/)).toBeInTheDocument();
  });

  it("본문 첫 행이 sub-header 패턴(col 0 빈, 다른 본문 행은 col 0 있음)이면 헤더에 merge — '서비스 제공 기준' 케이스", () => {
    // 헤더 [서비스 구분, 부가서비스 제공기준, "", ..., 비고]
    // sub [_, 기본접수, 경쟁률, ..., 성적산출]
    // 본문 [4년제, ○, ○, ...]
    const parsed: PricingSheetParsed = {
      원서접수: [
        {
          category: "원서접수",
          title: "서비스 제공 기준",
          rows: [
            ["서비스 구분", "부가서비스 제공기준", "", "", "", "", "", "", "", "비고"],
            ["", "기본접수", "경쟁률", "자기소개서", "추천서", "계좌인증", "2단계", "불합격", "성적산출"],
            ["4년제", "○", "○", "○", "○", "△", "○", "X", "○"],
          ],
          notes: [],
        },
      ],
      PIMS: [],
      입학상담앱: [],
    };
    render(<PricingSheet parsed={parsed} />);
    // sub-header 라벨이 columnheader로 노출되어야 함 (본문 데이터 cell이 아님)
    expect(screen.getByRole("columnheader", { name: "기본접수" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "성적산출" })).toBeInTheDocument();
    // 본문 첫 cell이 "4년제"여야 함 — sub-header가 본문에서 사라져야 함
    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("4년제");
  });

  it("3 카테고리 button 요소 노출 — active(원서접수)는 aria-pressed=true + bold text-ink", () => {
    render(<PricingSheet parsed={parsed} />);
    const buttons = CATEGORY_BUTTON_LABELS.map((label) =>
      screen.getByRole("button", { name: new RegExp(label) }),
    );
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "false");
    expect(buttons[0].className).toContain("font-medium");
    expect(buttons[0].className).toContain("bg-vermilion");
  });

  it("헤더의 빈 셀은 직전 셀의 colspan에 합산 (PIMS 표처럼 본문이 헤더보다 col 많은 경우)", () => {
    // 헤더: [구분, "", 신규구축, 사용료] → [구분(colspan=2), 신규구축, 사용료]
    // 본문: [전체사용, 기본 서비스, 3,500만원, 800만원] (4 cells)
    const pimsParsed: PricingSheetParsed = {
      원서접수: [],
      입학상담앱: [],
      PIMS: [
        {
          category: "PIMS",
          title: "서비스 제공 기준",
          rows: [
            ["구분", "", "신규구축", "사용료"],
            ["전체사용", "기본 서비스", "3,500만원", "800만원"],
          ],
          notes: [],
        },
      ],
    };
    render(<PricingSheet parsed={pimsParsed} />);
    fireEvent.click(screen.getByRole("button", { name: /PIMS/ }));
    const headerCell = screen.getByRole("columnheader", { name: "구분" });
    expect(headerCell).toHaveAttribute("colspan", "2");
    // 빈 헤더 셀은 노출되지 않음 (직전 colspan으로 흡수)
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
  });
});
