import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";

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

import { WeeklyKpiRowV2 as WeeklyKpiRow } from "../_components/WeeklyKpiRowV2";
import { SubTabs } from "../_components/SubTabs";
import { useOpsArea } from "../_components/use-ops-area";
import { OpsPathProvider } from "../_components/ops-path";
import { setUrl } from "./search-params-mock";

// 모든 호출이 본인 보고서를 본다. 어느 영역인지는 주소(setUrl)가 정한다.
const BASE = { weekStart: "2026-11-16", op: null } as const;
const W = "/dashboard/ops-weekly?week=2026-11-16";

const KPIS = {
  dev: 1,
  test: 2,
  opening: 3,
  running: 4,
  closing: 5,
  pims: 6,
  scoreCalc: null,
  leave: 8,
};

beforeEach(() => {
  setUrl("?week=2026-11-16&tab=application");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WeeklyKpiRowV2", () => {
  it("카드 8장 라벨 순서 + 수집 전은 '구분 미확인'(0 아님)", () => {
    render(
      <WeeklyKpiRow
        {...BASE}
       
        kpis={{
          dev: null,
          test: null,
          opening: 2,
          running: 5,
          closing: 1,
          pims: 0,
          scoreCalc: null,
          leave: 0,
        }}
      />,
    );
    expect(
      screen.getAllByTestId("weekly-kpi-label").map((n) => n.textContent),
    ).toEqual([
      "운영 중",
      "개발 중",
      "테스트 중",
      "차주 오픈 예정",
      "합격자 발표",
      "성적산출",
      "휴가·외근",
      "차주 마감 예정",
    ]);
    expect(screen.getAllByText("구분 미확인")).toHaveLength(2);
    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(screen.queryByText("PIMS 발표 예정")).toBeNull();
  });

  it("일부만 수집됐으면 개발·테스트 숫자 옆에 '구분 미확인 N건'을 적는다", () => {
    render(
      <WeeklyKpiRow
        {...BASE}
       
        kpis={{
          dev: 3,
          test: 1,
          opening: 2,
          running: 5,
          closing: 1,
          pims: 0,
          scoreCalc: null,
          leave: 0,
        }}
        unknownCount={4}
      />,
    );
    expect(screen.getAllByText("구분 미확인 4건")).toHaveLength(2);
  });

  it("미확인이 0건이면 문구를 안 띄운다", () => {
    render(
      <WeeklyKpiRow
        {...BASE}
       
        kpis={{
          dev: 3,
          test: 1,
          opening: 2,
          running: 5,
          closing: 1,
          pims: 0,
          scoreCalc: null,
          leave: 0,
        }}
        unknownCount={0}
      />,
    );
    expect(screen.queryByText(/구분 미확인/)).toBeNull();
  });

  it("카드 위 캡션 줄이 없다 — 새 화면은 카드만(2026-11-25 사용자 지시)", () => {
    render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
    expect(screen.queryByText(/이번 주 · 항목 간 중복/)).toBeNull();
  });

  it("숫자 뒤 단위 '건'은 muted, 값이 없는 카드에는 단위가 없다", () => {
    render(
      <WeeklyKpiRow
        {...BASE}
       
        kpis={{
          dev: null,
          test: null,
          opening: 2,
          running: 5,
          closing: 1,
          pims: 0,
          scoreCalc: null,
          leave: 0,
        }}
      />,
    );
    const units = screen.getAllByText("건");
    expect(units).toHaveLength(5);
    expect(units[0].className.split(/\s+/)).toContain("text-muted");
  });

  it("카드는 운영리포트 KpiCard 모양 — 라벨·큰 숫자·단위뿐, 대학구분 칸·묶음 카드가 없다", () => {
    render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryAllByTestId("weekly-kpi-univ")).toHaveLength(0);
    const card = screen.getByText("휴가·외근").closest("a") as Element;
    expect(card.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["border", "p-4", "gap-1", "bg-situation-bg"]),
    );
    const num = screen.getByText("8").className.split(/\s+/);
    expect(num).toEqual(
      expect.arrayContaining(["text-2xl", "font-bold", "tabular-nums"]),
    );
    expect(num).not.toContain("font-mono");
  });

  describe("카드는 링크다", () => {
    const hrefOf = (label: string) =>
      screen.getByText(label).closest("a")?.getAttribute("href");

    it("href 는 같은 주·탭에 sub 를 붙이고, 합격자 발표는 PIMS 탭", () => {
      render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
      expect(hrefOf("개발 중")).toBe(`${W}&tab=application&sub=dev`);
      expect(hrefOf("테스트 중")).toBe(`${W}&tab=application&sub=test`);
      expect(hrefOf("운영 중")).toBe(`${W}&tab=application&sub=running`);
      expect(hrefOf("차주 오픈 예정")).toBe(`${W}&tab=application&sub=opening`);
      expect(hrefOf("차주 마감 예정")).toBe(`${W}&tab=application&sub=closing`);
      expect(hrefOf("합격자 발표")).toBe(`${W}&tab=pims`);
      expect(hrefOf("휴가·외근")).toBe(`${W}&tab=leave`);
    });

    it("남의 보고서를 보는 중이면 op 를 유지한다", () => {
      render(
        <WeeklyKpiRow {...BASE} op="a@x" kpis={KPIS} />,
      );
      expect(hrefOf("운영 중")).toBe(
        `${W}&tab=application&op=a%40x&sub=running`,
      );
      expect(hrefOf("합격자 발표")).toBe(`${W}&tab=pims&op=a%40x`);
    });

    it("원서접수 탭: 하위 탭 기본(개발 중)이 활성 — vermilion 보더·aria-current, 숫자는 ink", () => {
      render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
      const dev = screen.getByText("개발 중").closest("a") as HTMLElement;
      expect(dev).toHaveAttribute("aria-current", "true");
      expect(dev.className).toContain("border-vermilion");
      expect(dev.className).toContain("bg-vermilion/10");
      expect(screen.getByText("개발 중").className).toContain("text-vermilion");
      const num = screen.getByText("1").className.split(/\s+/);
      expect(num).toContain("text-ink");
      expect(num).not.toContain("text-vermilion");
      const test = screen.getByText("테스트 중").closest("a") as HTMLElement;
      expect(test).not.toHaveAttribute("aria-current");
      expect(test.className).toContain("border-line-soft");
      expect(test.className).toContain("hover:border-ink");
      expect(test.className).not.toContain("hover:bg-");
      expect(test.className).toContain("bg-situation-bg");
      expect(test.className).toContain("focus-visible:outline-2");
    });

    it("sub 가 URL 에 있으면 그 카드가 활성", () => {
      setUrl("?week=2026-11-16&tab=application&sub=closing");
      render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
      const closing = screen.getByText("차주 마감 예정").closest("a");
      expect(closing).toHaveAttribute("aria-current", "true");
      expect(closing?.className).toContain("border-vermilion");
      const opening = screen.getByText("차주 오픈 예정").closest("a");
      expect(opening).not.toHaveAttribute("aria-current");
      expect(opening?.className).toContain("border-line-soft");
      expect(opening?.className).toContain("hover:border-ink");
      expect(screen.getByText("개발 중").closest("a")).not.toHaveAttribute(
        "aria-current",
      );
    });

    it("PIMS 탭에서는 합격자 발표만 활성(하위 탭 무관)", () => {
      setUrl("?week=2026-11-16&tab=pims&sub=nextWeek");
      render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
      expect(screen.getByText("합격자 발표").closest("a")).toHaveAttribute(
        "aria-current",
        "true",
      );
      expect(screen.getByText("개발 중").closest("a")).not.toHaveAttribute(
        "aria-current",
      );
    });

    it("성적산출은 데이터 연결 전 — 링크가 아니고 숫자 대신 '연결 전'", () => {
      render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
      expect(screen.getByText("성적산출").closest("a")).toBeNull();
      expect(screen.getByText("연결 전")).toBeInTheDocument();
    });

    it("같은 탭 안에서 누르면 이동 없이 URL 의 sub 만 바뀐다", () => {
      render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
      const link = screen.getByText("운영 중").closest("a") as HTMLElement;
      expect(fireEvent.click(link)).toBe(false);
      expect(window.location.search).toContain("sub=running");
      expect(screen.getByText("운영 중").closest("a")).toHaveAttribute(
        "aria-current",
        "true",
      );
    });

    it("수정 키를 누른 클릭은 가로채지 않는다", () => {
      render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
      const link = screen.getByText("운영 중").closest("a") as HTMLElement;
      expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
      expect(fireEvent.click(link, { metaKey: true })).toBe(true);
      expect(fireEvent.click(link, { shiftKey: true })).toBe(true);
      expect(window.location.search).not.toContain("sub=running");
    });

    it("같은 탭 클릭은 하위 탭 줄을 보이는 자리까지 스크롤한다(nearest)", () => {
      const spy = vi.fn();
      Element.prototype.scrollIntoView = spy;
      const target = document.createElement("div");
      target.id = "ops-subtabs-application";
      document.body.appendChild(target);
      render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
      fireEvent.click(screen.getByText("운영 중").closest("a") as HTMLElement);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ block: "nearest" });
      expect(spy.mock.contexts[0]).toBe(target);
      target.remove();
    });

    it("PIMS 탭에서 합격자 발표 카드는 서버를 안 거치고 금주 발표로 돌린다", () => {
      setUrl("?week=2026-11-16&tab=pims&sub=nextWeek");
      render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
      const link = screen
        .getByText("합격자 발표")
        .closest("a") as HTMLElement;
      expect(fireEvent.click(link)).toBe(false);
      expect(window.location.search).toContain("sub=thisWeek");
    });

    it("휴가·외근 카드는 tab=leave 로 바꾸고 sub 를 지운다", () => {
      setUrl("?week=2026-11-16&tab=application&sub=dev");
      render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
      const link = screen.getByText("휴가·외근").closest("a") as HTMLElement;
      expect(fireEvent.click(link)).toBe(false);
      expect(window.location.search).toBe("?week=2026-11-16&tab=leave");
      expect(link).toHaveAttribute("aria-current", "true");
    });

    it("구분 미수집 주: 기본 활성은 운영 중, 수집된 주는 개발 중", () => {
      const { unmount } = render(
        <WeeklyKpiRow
          {...BASE}
          appSubState={{ showUnknown: false, collected: false }}
         
          kpis={KPIS}
        />,
      );
      expect(screen.getByText("운영 중").closest("a")).toHaveAttribute(
        "aria-current",
        "true",
      );
      expect(screen.getByText("개발 중").closest("a")).not.toHaveAttribute(
        "aria-current",
      );
      unmount();
      render(
        <WeeklyKpiRow
          {...BASE}
          appSubState={{ showUnknown: false, collected: true }}
         
          kpis={KPIS}
        />,
      );
      expect(screen.getByText("개발 중").closest("a")).toHaveAttribute(
        "aria-current",
        "true",
      );
    });

    it("안 보이는 구분 미확인(sub=unknown)이면 SubTabs 와 같이 기본 카드가 활성", () => {
      setUrl("?week=2026-11-16&tab=application&sub=unknown");
      render(
        <WeeklyKpiRow
          {...BASE}
          appSubState={{ showUnknown: false, collected: true }}
         
          kpis={KPIS}
        />,
      );
      expect(screen.getByText("개발 중").closest("a")).toHaveAttribute(
        "aria-current",
        "true",
      );
    });

    it("다른 영역 카드(합격자 발표)도 가로채 tab=pims·sub=thisWeek 로 바꾼다", () => {
      setUrl("?week=2026-11-16&tab=application&sub=dev");
      render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
      const link = screen
        .getByText("합격자 발표")
        .closest("a") as HTMLElement;
      expect(fireEvent.click(link)).toBe(false);
      expect(window.location.search).toBe(
        "?week=2026-11-16&tab=pims&sub=thisWeek",
      );
      expect(link).toHaveAttribute("aria-current", "true");
    });

    it("합격자 발표에서 운영 중 카드 → tab=application·sub=running", () => {
      setUrl("?week=2026-11-16&tab=pims&sub=nextWeek");
      render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
      const link = screen.getByText("운영 중").closest("a") as HTMLElement;
      expect(fireEvent.click(link)).toBe(false);
      expect(window.location.search).toBe(
        "?week=2026-11-16&tab=application&sub=running",
      );
      expect(link).toHaveAttribute("aria-current", "true");
      expect(
        screen.getByText("합격자 발표").closest("a"),
      ).not.toHaveAttribute("aria-current");
    });

    it("남의 보고서(op)를 보는 중이어도 클릭이 op 를 지우지 않는다", () => {
      setUrl("?week=2026-11-16&tab=application&op=a%40x");
      render(
        <WeeklyKpiRow {...BASE} op="a@x" kpis={KPIS} />,
      );
      fireEvent.click(
        screen.getByText("합격자 발표").closest("a") as Element,
      );
      expect(window.location.search).toBe(
        "?week=2026-11-16&tab=pims&op=a%40x&sub=thisWeek",
      );
    });

    it("수정 키 클릭은 다른 영역 카드도 가로채지 않는다", () => {
      render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
      const link = screen
        .getByText("합격자 발표")
        .closest("a") as HTMLElement;
      const before = window.location.search;
      expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
      expect(fireEvent.click(link, { metaKey: true })).toBe(true);
      expect(window.location.search).toBe(before);
    });

    // Review Focus 1 — 원서접수·합격자 발표 본문을 함께 마운트하면 하위 탭 줄 id 가 같으면 안 된다.
    it("RF1 원서접수·합격자 발표 하위 탭을 함께 마운트해도 줄 id 가 다르고, 카드는 그 영역 줄로 스크롤한다", () => {
      setUrl("?week=2026-11-16&tab=application");
      render(
        <>
          <SubTabs
            tab="application"
            ariaLabel="원서접수 묶음"
            tabs={[{ key: "dev", label: "개발 중", count: 1 }]}
            panels={{ dev: null }}
          />
          <div hidden>
            <SubTabs
              tab="pims"
              ariaLabel="합격자 발표 묶음"
              tabs={[{ key: "thisWeek", label: "금주 발표", count: 1 }]}
              panels={{ thisWeek: null }}
            />
          </div>
          <WeeklyKpiRow
            kpis={KPIS}
           
            weekStart="2026-11-16"
            op={null}
          />
        </>,
      );
      expect(
        document.querySelectorAll(
          "#ops-subtabs-application, #ops-subtabs-pims",
        ),
      ).toHaveLength(2);
      const target = document.getElementById("ops-subtabs-pims") as HTMLElement;
      target.scrollIntoView = vi.fn();
      fireEvent.click(
        screen.getByText("합격자 발표").closest("a") as HTMLElement,
      );
      expect(target.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    });

    // F3 — 다른 영역 카드의 스크롤은 영역이 커밋돼 그 패널이 hidden 에서 풀린 뒤에 일어난다.
    // 클릭 핸들러 안에서(또는 rAF 한 번 안에서) 스크롤하면 Next 의 transition 커밋보다 앞서 숨은 줄을 가리킨다.
    it("F3 다른 영역 카드의 스크롤은 그 영역 패널이 보인 뒤에 한 번 일어난다", () => {
      function Areas() {
        const { area } = useOpsArea();
        return (
          <>
            <div hidden={area !== "application"}>
              <SubTabs
                tab="application"
                ariaLabel="원서접수 묶음"
                tabs={[{ key: "dev", label: "개발 중", count: 1 }]}
                panels={{ dev: null }}
              />
            </div>
            <div hidden={area !== "pims"}>
              <SubTabs
                tab="pims"
                ariaLabel="합격자 발표 묶음"
                tabs={[{ key: "thisWeek", label: "금주 발표", count: 1 }]}
                panels={{ thisWeek: null }}
              />
            </div>
          </>
        );
      }
      setUrl("?week=2026-11-16&tab=application");
      render(
        <>
          <Areas />
          <WeeklyKpiRow {...BASE} kpis={KPIS} />
        </>,
      );
      const target = document.getElementById("ops-subtabs-pims") as HTMLElement;
      const visibleAtCall: boolean[] = [];
      target.scrollIntoView = vi.fn(() => {
        visibleAtCall.push(target.closest("[hidden]") === null);
      });
      fireEvent.click(
        screen.getByText("합격자 발표").closest("a") as HTMLElement,
      );
      expect(visibleAtCall).toEqual([true]);
      expect(target.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    });

    it("F3 영역 탭 등 카드 밖에서 영역이 바뀌어도 스크롤은 일어나지 않는다", () => {
      setUrl("?week=2026-11-16&tab=application");
      render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
      const target = document.createElement("div");
      target.id = "ops-subtabs-pims";
      target.scrollIntoView = vi.fn();
      document.body.appendChild(target);
      act(() => {
        setUrl("?week=2026-11-16&tab=pims");
      });
      expect(target.scrollIntoView).not.toHaveBeenCalled();
      target.remove();
    });
  });

  it("그리드는 운영리포트와 같은 2열 → md 4열(두 줄 × 4장), 카드는 min-w-0", () => {
    render(<WeeklyKpiRow {...BASE} kpis={KPIS} />);
    const grid = screen
      .getAllByTestId("weekly-kpi-label")[0]
      .closest(".grid") as Element;
    expect(grid.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["grid-cols-2", "md:grid-cols-4", "gap-3"]),
    );
    expect(grid.children).toHaveLength(8);
    expect(
      (screen.getByText("개발 중").closest("a") as Element).className,
    ).toContain("min-w-0");
  });

  it("새 화면 메뉴 안에서는 카드 링크가 그 메뉴 주소에 머문다", () => {
    render(
      <OpsPathProvider path="/dashboard/ops-weekly-v2">
        <WeeklyKpiRow {...BASE} kpis={KPIS} />
      </OpsPathProvider>,
    );
    expect(
      screen.getByText("운영 중").closest("a")?.getAttribute("href"),
    ).toBe(
      "/dashboard/ops-weekly-v2?week=2026-11-16&tab=application&sub=running",
    );
  });
});
