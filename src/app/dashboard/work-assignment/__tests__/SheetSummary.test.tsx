import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SheetSummary } from "../SheetSummary";
import type { SheetSummaryRow } from "@/features/assignments/sheet-summary";

/**
 * 시트별 현황 — 담당 대학 295곳이 **어느 시트의 것인지** 말하는 자리(사용자 요구
 * 2026-09-22).
 *
 * 이 표의 어려운 점은 **행의 합이 합계와 안 맞는다**는 것이다(467곳 ↔ 295곳). 한
 * 대학이 여러 시트에 걸려 있어서인데, 화면이 그 이유를 안 적으면 다음 사람이 둘 중
 * 하나를 버그로 보고 '고친다'.
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
const SUMMARY = { people: 21, universities: 295, services: 1112 };

const rowOf = (name: string | RegExp) =>
  screen.getByRole("row", { name: new RegExp(name) });

describe("SheetSummary", () => {
  it("시트 이름으로 줄을 세운다 — 사람이 여는 것은 시트다", () => {
    render(<SheetSummary rows={ROWS} summary={SUMMARY} />);

    const row = rowOf("02. 배정리스트");
    expect(within(row).getByText("293")).toBeInTheDocument();
    expect(within(row).getByText("568")).toBeInTheDocument();
  });

  it("원천이 없는 시트는 0 이 아니라 '없음' 이라고 적는다", () => {
    /*
     * 성적산출 44곳은 마감에도 발표에도 없다. 0 으로 적으면 그 44곳이 아무 일도
     * 안 하는 것처럼 보이고, 그건 '일이 없다' 와 '못 센다' 를 같은 칸에 적는 것이다.
     */
    render(<SheetSummary rows={ROWS} summary={SUMMARY} />);

    const row = rowOf("06. 성적산출");
    expect(within(row).queryByText("0")).toBeNull();
    expect(within(row).getByText(/원천 없음/)).toBeInTheDocument();
  });

  it("합계는 카드와 같은 값을 쓴다 — 두 군데서 다시 세지 않는다", () => {
    /*
     * 여기서 행을 더해 합계를 내면 467곳이 나와 카드(295곳)와 갈린다. 같은 화면의
     * 두 숫자가 다른 값을 말하면 어느 쪽이 사실인지 볼 곳이 없다.
     */
    render(<SheetSummary rows={ROWS} summary={SUMMARY} />);

    const row = rowOf("합계");
    expect(within(row).getByText("295")).toBeInTheDocument();
    expect(within(row).getByText("1,112")).toBeInTheDocument();
  });

  it("행의 합이 합계보다 큰 이유를 적는다", () => {
    render(<SheetSummary rows={ROWS} summary={SUMMARY} />);

    expect(screen.getByText(/여러 시트/)).toBeInTheDocument();
  });

  it("제목은 표 위 제목 표준이다 — 작으면 표에 붙어 보인다", () => {
    /*
     * `panel-heading-standard` 가드는 `<header className>` 을 가진 파일만 본다.
     * 이 파일은 그 가드 밖이라, 표준을 여기서 직접 붙잡는다 — 가드 범위를 벗어난
     * 자리가 곧 표준이 무너지는 자리다(#1216 이 그렇게 깨졌다).
     */
    render(<SheetSummary rows={ROWS} summary={SUMMARY} />);

    const heading = screen.getByRole("heading", { name: /시트별/ });
    expect(heading.className).toMatch(/text-xl/);
    expect(heading.className).toMatch(/font-bold/);
  });
});
