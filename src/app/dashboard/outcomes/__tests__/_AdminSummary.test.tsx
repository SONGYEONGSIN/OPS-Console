import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminSummary } from "../_AdminSummary";

describe("AdminSummary", () => {
  it("전체/완료 카운트 노출", () => {
    render(
      <AdminSummary
        total={5}
        stepCounts={{ 1: 1, 2: 1, 3: 0, 4: 0, 5: 1, 6: 0, 7: 0, 8: 2 }}
      />,
    );
    expect(screen.getByText(/전체 5건/)).toBeInTheDocument();
    expect(screen.getByText(/완료 2건/)).toBeInTheDocument();
    expect(screen.getByText(/40%/)).toBeInTheDocument();
  });

  it("총 0건 — 0% 표시", () => {
    render(
      <AdminSummary
        total={0}
        stepCounts={{ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 }}
      />,
    );
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it("8단계 라벨 모두 노출", () => {
    render(
      <AdminSummary
        total={1}
        stepCounts={{ 1: 1, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 }}
      />,
    );
    // step 8 '완료'는 헤더 '완료 N건'과 충돌 — 7개만 단일 매칭 + 완료는 별도.
    for (const label of [
      "목표설정",
      "실행계획",
      "계획검토",
      "중간점검",
      "점검검토",
      "자기평가",
      "종합평가",
    ]) {
      expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
    }
    // '완료'는 header + step8 라벨 = 2건 이상 노출
    expect(screen.getAllByText(/완료/).length).toBeGreaterThanOrEqual(2);
  });
});
