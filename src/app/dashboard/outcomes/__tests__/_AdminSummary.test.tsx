import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminSummary } from "../_AdminSummary";

describe("AdminSummary", () => {
  it("전체(팀원총원)/발행완료 카운트 노출", () => {
    render(<AdminSummary teamSize={5} stepCounts={{ 1: 1, 2: 1, 3: 1, 4: 2 }} />);
    expect(screen.getByText(/전체 5명/)).toBeInTheDocument();
    expect(screen.getByText(/발행완료 2명/)).toBeInTheDocument();
    // 헤더 발행완료율 40% + 카드 4 완료율 40% (다중 매칭)
    expect(screen.getAllByText(/40%/).length).toBeGreaterThanOrEqual(1);
  });

  it("팀원 0명 — 0% 표시", () => {
    render(<AdminSummary teamSize={0} stepCounts={{ 1: 0, 2: 0, 3: 0, 4: 0 }} />);
    expect(screen.getAllByText(/0%/).length).toBeGreaterThanOrEqual(1);
  });

  it("각 카드 분모는 팀원총원 + 비중(완료율) 표기", () => {
    render(<AdminSummary teamSize={8} stepCounts={{ 1: 2, 2: 0, 3: 0, 4: 0 }} />);
    // 분모 = 8명 (사이클 미생성 인원 포함), 4개 카드 모두 /8명
    expect(screen.getAllByText(/\/ 8명/).length).toBe(4);
    expect(screen.getByText(/비중 25%/)).toBeInTheDocument(); // 2/8
  });

  it("4단계 라벨 모두 노출", () => {
    render(<AdminSummary teamSize={1} stepCounts={{ 1: 1, 2: 0, 3: 0, 4: 0 }} />);
    for (const label of ["목표설정", "실행계획", "정량집계"]) {
      expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
    }
    // '발행완료'는 header('발행완료 N명') + step4 라벨 = 2건 이상
    expect(screen.getAllByText(/발행완료/).length).toBeGreaterThanOrEqual(2);
  });
});
