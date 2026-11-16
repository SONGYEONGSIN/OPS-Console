import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeeklyKpiRow } from "../_components/WeeklyKpiRow";

describe("WeeklyKpiRow", () => {
  it("카드 6개 라벨 순서 + 수집 전은 '구분 미확인'(0 아님)", () => {
    render(
      <WeeklyKpiRow
        kpis={{
          dev: null,
          test: null,
          opening: 2,
          running: 5,
          closing: 1,
          pims: 0,
        }}
      />,
    );
    expect(
      screen.getAllByTestId("weekly-kpi-label").map((n) => n.textContent),
    ).toEqual([
      "개발 중",
      "테스트 중",
      "차주 오픈 예정",
      "운영 중",
      "차주 마감 예정",
      "PIMS 발표 예정",
    ]);
    expect(screen.getAllByText("구분 미확인")).toHaveLength(2);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("일부만 수집됐으면 개발·테스트 숫자 옆에 '구분 미확인 N건'을 적는다", () => {
    render(
      <WeeklyKpiRow
        kpis={{ dev: 3, test: 1, opening: 2, running: 5, closing: 1, pims: 0 }}
        unknownCount={4}
      />,
    );
    expect(screen.getAllByText("구분 미확인 4건")).toHaveLength(2);
  });

  it("미확인이 0건이면 문구를 안 띄운다", () => {
    render(
      <WeeklyKpiRow
        kpis={{ dev: 3, test: 1, opening: 2, running: 5, closing: 1, pims: 0 }}
        unknownCount={0}
      />,
    );
    expect(screen.queryByText(/구분 미확인/)).toBeNull();
  });
});
