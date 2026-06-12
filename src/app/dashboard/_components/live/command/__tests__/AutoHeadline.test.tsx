import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AutoHeadline } from "../AutoHeadline";
import type { HeadlineInput } from "../headline-selector";

const ZERO: HeadlineInput = {
  incidentsUnresolved: 0,
  deadlinesToday: 0,
  overdueReceivables: 0,
  inProgressServices: 0,
};

describe("AutoHeadline — urgent 렌더", () => {
  const input: HeadlineInput = {
    ...ZERO,
    incidentsUnresolved: 1,
    deadlinesToday: 3,
    topIncidentLabel: "원서 작성페이지 오류",
    topDeadlineLabel: "건국대(글로벌) 후기 2차",
  };

  it("crumb · AUTO 배지 · kicker · 결합 타이틀 · sub · 긴급 stamp 노출", () => {
    render(<AutoHeadline input={input} />);
    expect(screen.getByText("실시간 현황")).toBeInTheDocument();
    expect(screen.getByText(/AUTO/)).toBeInTheDocument();
    expect(screen.getByText("▲ 오늘의 톱 · 즉시")).toBeInTheDocument();
    // 타이틀 텍스트 (조각 결합)
    expect(screen.getByText(/마감 임박/)).toBeInTheDocument();
    expect(screen.getByText(/미처리 사고/)).toBeInTheDocument();
    expect(screen.getByText(/원서 작성페이지 오류/)).toBeInTheDocument();
    // 우측 vermilion 원형 stamp (바로처리 버튼 대체)
    expect(screen.getByText("긴급")).toBeInTheDocument();
  });

  it("긴급 stamp 링크가 가장 시급한 메뉴를 가리킨다", () => {
    render(<AutoHeadline input={input} />);
    const link = screen.getByRole("link", { name: /긴급/ });
    expect(link).toHaveAttribute("href", "/dashboard/incidents");
  });
});

describe("AutoHeadline — calm 렌더", () => {
  it("평온 카피와 대시보드 stamp 링크 노출", () => {
    render(<AutoHeadline input={{ ...ZERO, inProgressServices: 28 }} />);
    expect(screen.getByText("오늘 평온")).toBeInTheDocument();
    expect(screen.getByText(/긴급 건 없음/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /대시보드/ });
    expect(link).toHaveAttribute("href", "/dashboard");
  });
});
