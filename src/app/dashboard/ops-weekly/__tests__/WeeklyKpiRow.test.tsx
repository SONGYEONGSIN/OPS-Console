import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeeklyKpiRow } from "../_components/WeeklyKpiRow";

describe("WeeklyKpiRow", () => {
  it("카드 6개 라벨 순서 + 수집 전은 '구분 미확인'(0 아님)", () => {
    render(
      <WeeklyKpiRow
        ownerName="홍길동"
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
      "운영 중",
      "PIMS 발표 예정",
      "차주 오픈 예정",
      "차주 마감 예정",
    ]);
    expect(screen.getAllByText("구분 미확인")).toHaveLength(2);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("일부만 수집됐으면 개발·테스트 숫자 옆에 '구분 미확인 N건'을 적는다", () => {
    render(
      <WeeklyKpiRow
        ownerName="홍길동"
        kpis={{ dev: 3, test: 1, opening: 2, running: 5, closing: 1, pims: 0 }}
        unknownCount={4}
      />,
    );
    expect(screen.getAllByText("구분 미확인 4건")).toHaveLength(2);
  });

  it("미확인이 0건이면 문구를 안 띄운다", () => {
    render(
      <WeeklyKpiRow
        ownerName="홍길동"
        kpis={{ dev: 3, test: 1, opening: 2, running: 5, closing: 1, pims: 0 }}
        unknownCount={0}
      />,
    );
    expect(screen.queryByText(/구분 미확인/)).toBeNull();
  });

  it("누구의 숫자인지 캡션으로 밝힌다", () => {
    render(
      <WeeklyKpiRow
        ownerName="홍길동"
        kpis={{ dev: 1, test: 1, opening: 1, running: 1, closing: 1, pims: 1 }}
      />,
    );
    const caption = screen.getByText(/^홍길동의 이번 주/);
    const t = caption.className.split(/\s+/);
    expect(t).toContain("text-xs");
    expect(t).toContain("text-muted");
    expect(caption).toHaveTextContent("항목 간 중복 집계될 수 있습니다");
  });

  it("숫자 뒤 단위 '건'은 muted, 값이 없는 카드에는 단위가 없다", () => {
    render(
      <WeeklyKpiRow
        ownerName="홍길동"
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
    const units = screen.getAllByText("건");
    expect(units).toHaveLength(4);
    expect(units[0].className.split(/\s+/)).toContain("text-muted");
  });

  describe("차주 오픈·마감은 한 장", () => {
    const kpis = {
      dev: 1,
      test: 1,
      opening: 2,
      running: 5,
      closing: 7,
      pims: 0,
    };
    const tok = (el: Element) => el.className.split(/\s+/);

    it("카드 하나(group)가 두 칸을 품고, 합계는 내지 않는다", () => {
      render(<WeeklyKpiRow ownerName="홍길동" kpis={kpis} />);
      const card = screen.getByRole("group", { name: "차주 오픈 / 마감" });
      expect(card).toHaveTextContent("차주 오픈 예정");
      expect(card).toHaveTextContent("차주 마감 예정");
      // 2 + 7 = 9 를 적지 않는다 — 겹칠 수 있어 합이 뜻을 잃는다
      expect(card).not.toHaveTextContent("9");
      expect(tok(card)).toContain("col-span-2");
      expect(tok(card)).toContain("border-line-soft");
      expect(tok(card)).toContain("bg-situation-bg");
    });

    it("칸 사이에 세로 구분선, 숫자는 tabular-nums", () => {
      render(<WeeklyKpiRow ownerName="홍길동" kpis={kpis} />);
      const card = screen.getByRole("group", { name: "차주 오픈 / 마감" });
      const dividers = card.querySelectorAll(".w-px");
      expect(dividers).toHaveLength(1);
      expect(tok(dividers[0])).toContain("bg-line-soft");
      const num = screen.getByText("7");
      expect(tok(num)).toContain("tabular-nums");
      expect(tok(num)).not.toContain("font-mono");
    });

    it("좁은 화면에서도 칸이 넘치지 않는다(min-w-0 + 줄바꿈 허용)", () => {
      render(<WeeklyKpiRow ownerName="홍길동" kpis={kpis} />);
      const card = screen.getByRole("group", { name: "차주 오픈 / 마감" });
      const row = card.querySelector(".w-px")?.parentElement?.parentElement;
      expect(row).toBeTruthy();
      expect(tok(row as Element)).toContain("flex");
      const segs = card.querySelectorAll("[data-segment]");
      expect(segs).toHaveLength(2);
      segs.forEach((n) => expect(tok(n)).toContain("min-w-0"));
    });
  });
});
