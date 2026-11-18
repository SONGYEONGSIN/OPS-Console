import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock(
  "next/navigation",
  async () => (await import("./search-params-mock")).navigationModule,
);

// 실제 Link 는 클릭을 라우터로 넘기며 preventDefault 한다 — 우리가 가로챘는지만 보려고 앵커로 바꾼다.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WeeklyKpiRow } from "../_components/WeeklyKpiRow";
import { setUrl } from "./search-params-mock";

// 모든 호출이 같은 자리(원서접수 탭, 본인 보고서)를 본다.
const BASE = { tab: "application", weekStart: "2026-11-16", op: null } as const;
const W = "/dashboard/ops-weekly?week=2026-11-16";

const KPIS = { dev: 1, test: 2, opening: 3, running: 4, closing: 5, pims: 6 };

beforeEach(() => {
  setUrl("?week=2026-11-16&tab=application");
});
afterEach(cleanup);

describe("WeeklyKpiRow", () => {
  it("카드 라벨 순서(합격자 발표가 맨 끝) + 수집 전은 '구분 미확인'(0 아님)", () => {
    render(
      <WeeklyKpiRow
        {...BASE}
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
      "차주 오픈 예정",
      "차주 마감 예정",
      "합격자 발표",
    ]);
    expect(screen.getAllByText("구분 미확인")).toHaveLength(2);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("PIMS 발표 예정")).toBeNull();
  });

  it("일부만 수집됐으면 개발·테스트 숫자 옆에 '구분 미확인 N건'을 적는다", () => {
    render(
      <WeeklyKpiRow
        {...BASE}
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
        {...BASE}
        ownerName="홍길동"
        kpis={{ dev: 3, test: 1, opening: 2, running: 5, closing: 1, pims: 0 }}
        unknownCount={0}
      />,
    );
    expect(screen.queryByText(/구분 미확인/)).toBeNull();
  });

  it("누구의 숫자인지 캡션으로 밝힌다", () => {
    render(<WeeklyKpiRow {...BASE} ownerName="홍길동" kpis={KPIS} />);
    const caption = screen.getByText(/^홍길동의 이번 주/);
    const t = caption.className.split(/\s+/);
    expect(t).toContain("text-xs");
    expect(t).toContain("text-muted");
    expect(caption).toHaveTextContent("항목 간 중복 집계될 수 있습니다");
  });

  it("숫자 뒤 단위 '건'은 muted, 값이 없는 카드에는 단위가 없다", () => {
    render(
      <WeeklyKpiRow
        {...BASE}
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
    const kpis = { ...KPIS, opening: 2, running: 5, closing: 7, pims: 0 };
    const tok = (el: Element) => el.className.split(/\s+/);

    it("카드 하나(group)가 두 칸을 품고, 합계는 내지 않는다", () => {
      render(<WeeklyKpiRow {...BASE} ownerName="홍길동" kpis={kpis} />);
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
      render(<WeeklyKpiRow {...BASE} ownerName="홍길동" kpis={kpis} />);
      const card = screen.getByRole("group", { name: "차주 오픈 / 마감" });
      const dividers = card.querySelectorAll(".w-px");
      expect(dividers).toHaveLength(1);
      expect(tok(dividers[0])).toContain("bg-line-soft");
      const num = screen.getByText("7");
      expect(tok(num)).toContain("tabular-nums");
      expect(tok(num)).not.toContain("font-mono");
    });

    it("좁은 화면에서도 칸이 넘치지 않는다(min-w-0 + 줄바꿈 허용)", () => {
      render(<WeeklyKpiRow {...BASE} ownerName="홍길동" kpis={kpis} />);
      const card = screen.getByRole("group", { name: "차주 오픈 / 마감" });
      const row = card.querySelector(".w-px")?.parentElement?.parentElement;
      expect(row).toBeTruthy();
      expect(tok(row as Element)).toContain("flex");
      const segs = card.querySelectorAll("[data-segment]");
      expect(segs).toHaveLength(2);
      segs.forEach((n) => expect(tok(n)).toContain("min-w-0"));
    });

    it("바깥은 링크가 아니라 group(호버 없음), 두 칸이 각각 링크", () => {
      render(<WeeklyKpiRow {...BASE} ownerName="홍길동" kpis={kpis} />);
      const card = screen.getByRole("group", { name: "차주 오픈 / 마감" });
      expect(card.tagName).not.toBe("A");
      expect(card.querySelectorAll("a")).toHaveLength(2);
      expect(card.className).not.toContain("hover:");
    });
  });

  describe("카드는 링크다", () => {
    const hrefOf = (label: string) =>
      screen.getByText(label).closest("a")?.getAttribute("href");

    it("href 는 같은 주·탭에 sub 를 붙이고, 합격자 발표는 PIMS 탭", () => {
      render(<WeeklyKpiRow {...BASE} ownerName="홍길동" kpis={KPIS} />);
      expect(hrefOf("개발 중")).toBe(`${W}&tab=application&sub=dev`);
      expect(hrefOf("테스트 중")).toBe(`${W}&tab=application&sub=test`);
      expect(hrefOf("운영 중")).toBe(`${W}&tab=application&sub=running`);
      expect(hrefOf("차주 오픈 예정")).toBe(`${W}&tab=application&sub=opening`);
      expect(hrefOf("차주 마감 예정")).toBe(`${W}&tab=application&sub=closing`);
      expect(hrefOf("합격자 발표")).toBe(`${W}&tab=pims`);
    });

    it("남의 보고서를 보는 중이면 op 를 유지한다", () => {
      render(
        <WeeklyKpiRow {...BASE} op="a@x" ownerName="홍길동" kpis={KPIS} />,
      );
      expect(hrefOf("운영 중")).toBe(
        `${W}&tab=application&op=a%40x&sub=running`,
      );
      expect(hrefOf("합격자 발표")).toBe(`${W}&tab=pims&op=a%40x`);
    });

    it("원서접수 탭: 하위 탭 기본(개발 중)이 활성 — vermilion 보더·aria-current, 숫자는 ink", () => {
      render(<WeeklyKpiRow {...BASE} ownerName="홍길동" kpis={KPIS} />);
      const dev = screen.getByText("개발 중").closest("a") as HTMLElement;
      expect(dev).toHaveAttribute("aria-current", "true");
      expect(dev.className).toContain("border-vermilion");
      expect(dev.className).toContain("bg-vermilion/10");
      expect(screen.getByText("개발 중").className).toContain("text-vermilion");
      expect(screen.getByText("1").className).toContain("text-ink");
      const test = screen.getByText("테스트 중").closest("a") as HTMLElement;
      expect(test).not.toHaveAttribute("aria-current");
      expect(test.className).toContain("border-line-soft");
      expect(test.className).toContain("hover:border-ink");
      expect(test.className).not.toContain("hover:bg-");
      expect(test.className).toContain("bg-situation-bg");
      expect(test.className).toContain("focus-visible:outline-2");
    });

    it("sub 가 URL 에 있으면 그 카드가 활성, 오픈·마감은 칸 단위", () => {
      setUrl("?week=2026-11-16&tab=application&sub=closing");
      render(<WeeklyKpiRow {...BASE} ownerName="홍길동" kpis={KPIS} />);
      const closing = screen.getByText("차주 마감 예정").closest("a");
      expect(closing).toHaveAttribute("aria-current", "true");
      expect(closing?.className).toContain("border-vermilion");
      const opening = screen.getByText("차주 오픈 예정").closest("a");
      expect(opening).not.toHaveAttribute("aria-current");
      expect(opening?.className).toContain("border-transparent");
      expect(opening?.className).toContain("hover:border-ink");
      expect(screen.getByText("개발 중").closest("a")).not.toHaveAttribute(
        "aria-current",
      );
    });

    it("PIMS 탭에서는 합격자 발표만 활성(하위 탭 무관)", () => {
      setUrl("?week=2026-11-16&tab=pims&sub=nextWeek");
      render(
        <WeeklyKpiRow {...BASE} tab="pims" ownerName="홍길동" kpis={KPIS} />,
      );
      expect(screen.getByText("합격자 발표").closest("a")).toHaveAttribute(
        "aria-current",
        "true",
      );
      expect(screen.getByText("개발 중").closest("a")).not.toHaveAttribute(
        "aria-current",
      );
    });

    it("제출 현황·설정 탭에서는 어떤 카드도 활성이 아니다", () => {
      for (const tab of ["status", "settings"] as const) {
        const { unmount } = render(
          <WeeklyKpiRow {...BASE} tab={tab} ownerName="홍길동" kpis={KPIS} />,
        );
        expect(document.querySelectorAll("[aria-current]")).toHaveLength(0);
        unmount();
      }
    });

    it("같은 탭 안에서 누르면 이동 없이 URL 의 sub 만 바뀐다", () => {
      render(<WeeklyKpiRow {...BASE} ownerName="홍길동" kpis={KPIS} />);
      const link = screen.getByText("운영 중").closest("a") as HTMLElement;
      expect(fireEvent.click(link)).toBe(false);
      expect(window.location.search).toContain("sub=running");
      expect(screen.getByText("운영 중").closest("a")).toHaveAttribute(
        "aria-current",
        "true",
      );
    });

    it("수정 키를 누른 클릭은 가로채지 않는다", () => {
      render(<WeeklyKpiRow {...BASE} ownerName="홍길동" kpis={KPIS} />);
      const link = screen.getByText("운영 중").closest("a") as HTMLElement;
      expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
      expect(fireEvent.click(link, { metaKey: true })).toBe(true);
      expect(fireEvent.click(link, { shiftKey: true })).toBe(true);
      expect(window.location.search).not.toContain("sub=running");
    });

    it("다른 탭으로 가는 카드(합격자 발표)는 가로채지 않는다", () => {
      render(<WeeklyKpiRow {...BASE} ownerName="홍길동" kpis={KPIS} />);
      const link = screen.getByText("합격자 발표").closest("a") as HTMLElement;
      expect(fireEvent.click(link)).toBe(true);
    });

    it("제출 현황 탭에서 누르면 원서접수로 일반 이동한다", () => {
      render(
        <WeeklyKpiRow {...BASE} tab="status" ownerName="홍길동" kpis={KPIS} />,
      );
      const link = screen.getByText("운영 중").closest("a") as HTMLElement;
      expect(fireEvent.click(link)).toBe(true);
    });
  });

  describe("그리드·카드 크기", () => {
    it("3열(폰·태블릿) → lg 6열, 카드는 min-w-0 이고 라벨은 줄바꿈 허용", () => {
      render(<WeeklyKpiRow {...BASE} ownerName="홍길동" kpis={KPIS} />);
      const grid = screen
        .getAllByTestId("weekly-kpi-label")[0]
        .closest(".grid") as Element;
      expect(grid.className.split(/\s+/)).toEqual(
        expect.arrayContaining([
          "grid-cols-3",
          "lg:grid-cols-6",
          "gap-2",
          "md:gap-3",
        ]),
      );
      expect(grid.className).not.toContain("grid-cols-2");
      const card = screen.getByText("개발 중").closest("a") as Element;
      expect(card.className).toContain("min-w-0");
      expect(card.className).toContain("p-3");
      expect(card.className).toContain("md:p-4");
      expect(screen.getByText("개발 중").className).toContain(
        "[overflow-wrap:anywhere]",
      );
      expect(screen.getByText("1").className).toContain("text-xl");
    });

    it("칸 합이 6(1+1+1 + 2+1) — 3열·6열 모두 빈 칸이 없다", () => {
      render(<WeeklyKpiRow {...BASE} ownerName="홍길동" kpis={KPIS} />);
      const grid = document.querySelector(".grid") as Element;
      const span = (el: Element) =>
        el.className.includes("col-span-2") ? 2 : 1;
      const total = [...grid.children].reduce((n, c) => n + span(c), 0);
      expect(total).toBe(6);
    });
  });
});
