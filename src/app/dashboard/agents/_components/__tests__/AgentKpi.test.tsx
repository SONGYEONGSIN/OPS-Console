import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentKpi } from "../AgentKpi";

/**
 * 관제 지표는 기간 비교가 아니라 **지금 상태**다. 그래서 공용 `KpiCard` 를 쓰지
 * 않는다 — 그쪽은 증감이 없으면 "비교 불가"를 찍는데, 여기서는 비교할 직전 기간이
 * 애초에 없다. 네 장 모두에 "비교 불가"가 뜨면 화면이 고장 난 것처럼 보인다.
 *
 * 대신 같은 시각 언어(테두리·배경·숫자 크기)를 쓰고, 아래 줄에는 **그 숫자를
 * 어떻게 읽어야 하는지**를 적는다.
 */
describe("AgentKpi", () => {
  it("라벨과 숫자를 카드로 보여준다", () => {
    render(<AgentKpi label="도는 중" value={6} note="회사 PC 폴러 6개" />);
    expect(screen.getByText("도는 중")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("회사 PC 폴러 6개")).toBeInTheDocument();
  });

  it("천 단위를 끊어 읽는다", () => {
    render(<AgentKpi label="오늘 실행" value={1234} note="" />);
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("경보 지표는 눈에 띄게 한다 — 관제탑에서 멈춤이 검은 글씨면 놓친다", () => {
    render(<AgentKpi label="멈춤" value={2} note="확인 필요" alert />);
    expect(screen.getByTestId("kpi-value")).toHaveClass("text-vermilion");
  });

  it("경보가 아니면 기본 색이다", () => {
    render(<AgentKpi label="멈춤" value={0} note="이상 없음" />);
    expect(screen.getByTestId("kpi-value")).toHaveClass("text-ink");
  });

  it("설명이 없으면 빈 줄을 만들지 않는다", () => {
    const { container } = render(<AgentKpi label="에이전트" value={29} note="" />);
    expect(container.textContent).not.toContain("비교 불가");
  });
});
