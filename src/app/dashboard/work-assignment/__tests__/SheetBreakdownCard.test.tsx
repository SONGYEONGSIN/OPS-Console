import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SheetBreakdownCard } from "../SheetBreakdownCard";
import type { SheetSummaryRow } from "@/features/assignments/sheet-summary";

/**
 * 시트별 내역을 **카드 안에서** 나눈다(사용자 요구 2026-09-23).
 *
 * 처음엔 카드 아래 따로 표를 뒀는데, 사용자가 운영리포트 `계약 체결` 카드를 가리키며
 * 그 모양을 요구했다 — 한 카드 제목 아래 세로 구분선으로 칸을 나누고 칸마다 큰 숫자를
 * 두는 형태다(`ContractSheetCard`). 카드와 표가 같은 숫자를 두 번 말하지도 않는다.
 *
 * **합이 총계와 다르다**는 사실은 여기서 못 적는다 — 카드 안에는 자리가 없다. 그래서
 * 총계는 카드 머리의 큰 숫자가 들고, 어긋나는 이유는 카드 묶음 아래 한 줄이 말한다.
 */
const ROWS: SheetSummaryRow[] = [
  {
    kind: "원서접수",
    sheet: "02. 배정리스트",
    universities: 293,
    services: 568,
  },
  { kind: "대학원", sheet: "03. 대학원", universities: 49, services: 411 },
  { kind: "PIMS", sheet: "04. PIMS", universities: 81, services: 133 },
  { kind: "성적산출", sheet: "06. 성적산출", universities: 44, services: null },
];

const card = () => screen.getByRole("group", { name: /담당 대학/ });

describe("SheetBreakdownCard", () => {
  it("카드 머리에 총계를 두고 칸마다 시트를 세운다", () => {
    render(
      <SheetBreakdownCard
        label="담당 대학"
        total={295}
        unit="곳"
        rows={ROWS}
        valueOf={(r) => r.universities}
      />,
    );

    expect(within(card()).getByText("295")).toBeInTheDocument();
    for (const sheet of [
      "02. 배정리스트",
      "03. 대학원",
      "04. PIMS",
      "06. 성적산출",
    ]) {
      expect(within(card()).getByText(sheet)).toBeInTheDocument();
    }
    expect(within(card()).getByText("293")).toBeInTheDocument();
  });

  it("값이 없는 칸은 0 이 아니라 '원천 없음' 이다", () => {
    /*
     * 성적산출 44곳은 마감에도 발표에도 없다. 0 으로 적으면 그 44곳이 아무 일도
     * 안 하는 것처럼 보인다 — '일이 없다' 와 '못 센다' 는 다른 사건이다.
     */
    render(
      <SheetBreakdownCard
        label="서비스 물량"
        total={1112}
        unit="건"
        rows={ROWS}
        valueOf={(r) => r.services}
      />,
    );

    const col = screen
      .getByRole("group", { name: /서비스 물량/ })
      .querySelector("[data-sheet='06. 성적산출']")!;
    expect(col.textContent).toMatch(/원천 없음/);
    expect(col.textContent).not.toMatch(/\b0\b/);
  });

  it("천 단위를 끊어 적는다 — 1112 는 읽는 데 시간이 걸린다", () => {
    render(
      <SheetBreakdownCard
        label="서비스 물량"
        total={1112}
        unit="건"
        rows={ROWS}
        valueOf={(r) => r.services}
      />,
    );

    expect(screen.getByText("1,112")).toBeInTheDocument();
  });

  it("카드에 이름이 있다 — 같은 말이 화면에 여러 번 나온다", () => {
    /*
     * `담당 대학` 은 카드 제목이기도 하고 다른 곳에도 나온다. 영역 이름이 없으면
     * 테스트가 라벨의 유일함에 기대게 되고, 그건 화면이 자라면 깨지는 가정이다.
     */
    render(
      <SheetBreakdownCard
        label="담당 대학"
        total={295}
        unit="곳"
        rows={ROWS}
        valueOf={(r) => r.universities}
      />,
    );

    expect(card()).toBeInTheDocument();
  });
});
