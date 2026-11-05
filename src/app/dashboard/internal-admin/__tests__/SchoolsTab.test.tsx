import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const push = vi.fn();
let params = new URLSearchParams("tab=schools");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/internal-admin",
  useSearchParams: () => params,
}));

vi.mock("@/features/sms-sender/actions", () => ({
  refreshSmsSenderCache: vi.fn(),
}));

import { parseSmsSender } from "@/features/sms-sender/parse";
import {
  rawSource,
  schoolRow,
  SCHOOL_HEADER,
} from "@/features/sms-sender/__tests__/fixtures";
import {
  gubunCards,
  STAGE_OPTIONS,
  type SchoolFilters,
} from "@/features/sms-sender/filters";
import {
  DOC_KINDS,
  type Completeness,
  type SmsSenderData,
} from "@/features/sms-sender/types";
import { SchoolsTab } from "../_components/SchoolsTab";
import type { ListContext } from "../_components/SmsListShell";

const data = parseSmsSender(rawSource());
const ctxOf = (d: SmsSenderData): ListContext => ({
  source: { fileName: d.workbook.name, fetchedAt: d.fetchedAt, criteria: null },
  lookup: { schools: d.schools, numbers: d.numbers, checks: d.checks },
});
const noFilters: SchoolFilters = {
  q: "",
  gubun: "",
  stage: "",
  docs: "",
  checkOnly: false,
  page: 1,
};
/** 클래스는 토큰 단위로 본다 — 부분 문자열이면 `text-ink` 가 `text-ink-soft` 에도 맞는다. */
const cls = (el: Element) => el.className.split(/\s+/);
const lastQuery = () =>
  new URLSearchParams(push.mock.calls.at(-1)![0].split("?")[1]);

const renderTab = (
  filters: Partial<SchoolFilters> = {},
  schools = data.schools,
) =>
  render(
    <SchoolsTab
      cards={gubunCards(data.schools)}
      schools={schools}
      total={schools.length}
      scopeTotal={data.schools.length}
      filters={{ ...noFilters, ...filters }}
      ctx={ctxOf(data)}
    />,
  );

describe("SchoolsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams("tab=schools");
  });

  it("머리 — 학교 · N곳, 내 대학 칩", () => {
    renderTab();
    const heading = screen.getByRole("heading", { name: "학교", level: 2 });
    expect(
      within(heading.closest("header")!).getByText("3곳"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내 대학" })).toBeInTheDocument();
  });

  it("검색·단계·서류·확인 필요만이 한 줄(검색줄)", () => {
    renderTab();
    const row = screen.getByLabelText("검색").closest<HTMLElement>("div.px-7")!;
    expect(cls(row)).toContain("pt-3");
    expect(within(row).getByLabelText("단계 필터")).toBeInTheDocument();
    expect(within(row).getByLabelText("서류 필터")).toBeInTheDocument();
    expect(within(row).getByLabelText("확인 필요만")).toBeInTheDocument();
  });

  it("머리글 칸은 표준 치수 그대로", () => {
    renderTab();
    const heads = screen.getAllByRole("columnheader");
    expect(heads.map((h) => h.textContent)).toEqual([
      "학교명",
      "구분",
      "단계",
      "회선",
      "서류",
      "확인",
      "PDF",
    ]);
    for (const h of heads) expect(h.className).toBe("px-3 py-2");
    expect(heads[0].closest("tr")!.className).toBe(
      "border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted",
    );
  });

  it("구분 카드 — 구분마다 따로 선 카드, 좁으면 두 칸·넓으면 한 줄", () => {
    const base = rawSource();
    const counted = parseSmsSender(
      rawSource({
        sheets: {
          ...base.sheets,
          schools: [
            SCHOOL_HEADER,
            schoolRow(1, "가나대학교", {
              "등록 회선": 3,
              "서류 미비": 1,
              확인: "확인 필요",
            }),
            schoolRow(2, "다라대학교", { "등록 회선": 2 }),
            schoolRow(3, "마바전문대학", { 구분: "전문대학" }),
          ],
        },
      }),
    );
    render(
      <SchoolsTab
        cards={gubunCards(counted.schools)}
        schools={counted.schools}
        total={counted.schools.length}
        scopeTotal={counted.schools.length}
        filters={noFilters}
        ctx={ctxOf(counted)}
      />,
    );
    // 바깥 상자는 없다 — 묶음은 격자일 뿐, 면은 카드마다.
    const group = screen.getByRole("group", { name: "구분" });
    const groupCls = group.className.split(/\s+/);
    for (const c of ["grid", "grid-cols-2", "gap-3", "@3xl:grid-cols-4"]) {
      expect(groupCls).toContain(c);
    }
    for (const c of ["border", "bg-situation-bg", "p-4"]) {
      expect(groupCls).not.toContain(c);
    }
    // 폭은 뷰포트가 아니라 컨테이너(사이드바·인스펙터가 줄인다)가 정한다.
    expect(group.parentElement!.className.split(/\s+/)).toContain("@container");
    expect(group.querySelectorAll("div.w-px")).toHaveLength(0);

    // 카드는 구분 순서 그대로, 한 장씩 표면 표준.
    const cards = within(group).getAllByRole("button");
    expect(cards.map((b) => b.querySelector("div")!.textContent)).toEqual(
      gubunCards(counted.schools).map((c) => c.gubun),
    );
    expect(cards.every((b) => b.parentElement === group)).toBe(true);
    for (const b of cards) {
      for (const c of [
        "border",
        "border-line-soft",
        "bg-situation-bg",
        "p-4",
      ]) {
        expect(b.className.split(/\s+/)).toContain(c);
      }
    }
    const card = within(group).getByRole("button", { name: /4년제/ });
    const label = within(card).getByText("4년제");
    expect(cls(label)).toContain("text-muted");
    const value = within(card).getByText("2");
    for (const c of ["text-2xl", "font-bold", "tabular-nums", "text-ink"]) {
      expect(cls(value)).toContain(c);
    }
    const unit = within(card).getByText("곳");
    expect(cls(unit)).toContain("text-muted");
    const stats = within(card).getByText("회선 5 · 서류 미비 1 · 확인 1");
    for (const c of ["text-xs", "text-muted", "tabular-nums"]) {
      expect(cls(stats)).toContain(c);
    }
    expect(within(group).queryByText("비교 불가")).toBeNull();

    fireEvent.click(card);
    expect(lastQuery().get("gubun")).toBe("4년제");
  });

  it("기타 구분이 있으면 카드 다섯 장 — 넓으면 다섯 칸 한 줄", () => {
    const base = rawSource();
    const withOther = parseSmsSender(
      rawSource({
        sheets: {
          ...base.sheets,
          schools: [
            SCHOOL_HEADER,
            schoolRow(1, "가나대학교"),
            schoolRow(2, "다라학교", { 구분: "해외" }),
          ],
        },
      }),
    );
    const cards = gubunCards(withOther.schools);
    expect(cards).toHaveLength(5);
    render(
      <SchoolsTab
        cards={cards}
        schools={withOther.schools}
        total={withOther.schools.length}
        scopeTotal={withOther.schools.length}
        filters={noFilters}
        ctx={ctxOf(withOther)}
      />,
    );
    const group = screen.getByRole("group", { name: "구분" });
    expect(within(group).getAllByRole("button")).toHaveLength(5);
    const gridCls = group.className.split(/\s+/);
    expect(gridCls).toContain("@3xl:grid-cols-5");
    expect(gridCls).not.toContain("@3xl:grid-cols-4");
    // 두 칸일 때 홀수 번째 마지막 카드(기타)는 두 칸을 다 쓴다 — 빈 칸 옆에 홀로 남지 않게.
    // 한 줄이 되면 다시 한 칸.
    expect(gridCls).toContain("[&>*:last-child:nth-child(odd)]:col-span-2");
    expect(gridCls).toContain("@3xl:[&>*:last-child:nth-child(odd)]:col-span-1");
  });

  it("회선·서류 미비·확인도 곳 수처럼 천 단위로 끊는다", () => {
    const base = rawSource();
    const big = parseSmsSender(
      rawSource({
        sheets: {
          ...base.sheets,
          schools: [
            SCHOOL_HEADER,
            schoolRow(1, "가나대학교", {
              "등록 회선": 1234,
              "서류 미비": 1500,
            }),
          ],
        },
      }),
    );
    render(
      <SchoolsTab
        cards={gubunCards(big.schools)}
        schools={big.schools}
        total={1}
        scopeTotal={1}
        filters={noFilters}
        ctx={ctxOf(big)}
      />,
    );
    const card = screen.getByRole("button", { name: /4년제/ });
    expect(
      within(card).getByText(/^회선 1,234 · 서류 미비 1,500 · 확인 \d+$/),
    ).toBeInTheDocument();
  });

  it("카드는 면(面) — 목록 호버·선택 표준, 링 없음, 다시 누르면 해제", () => {
    params = new URLSearchParams("tab=schools&gubun=4년제");
    renderTab({ gubun: "4년제" });
    const card = screen.getByRole("button", { name: /4년제/ });
    expect(card).toHaveAttribute("aria-pressed", "true");
    const onCls = card.className.split(/\s+/);
    expect(onCls).toContain("border-vermilion");
    expect(onCls).toContain("bg-vermilion/10");
    expect(onCls).not.toContain("border-line-soft");
    expect(onCls).not.toContain("bg-situation-bg");
    expect(card.className).not.toContain("ring");
    expect(card.className).not.toContain("hover:bg-ink");
    expect(cls(within(card).getByText("4년제"))).toContain(
      "text-vermilion",
    );
    const other = screen.getByRole("button", { name: /전문대학/ });
    expect(other).toHaveAttribute("aria-pressed", "false");
    expect(cls(other)).toContain("hover:bg-line-soft");
    expect(other.className.split(/\s+/)).toContain("border-line-soft");
    expect(other.className).not.toContain("border-vermilion");
    expect(other.className).not.toContain("bg-vermilion/10");
    expect(other.className).not.toContain("ring");
    expect(within(other).getByText("전문대학").className).not.toContain(
      "text-vermilion",
    );
    fireEvent.click(card);
    expect(lastQuery().get("gubun")).toBeNull();
  });

  /*
   * 앞말은 서류 필터와 같은 원천(제출 상태 → completeness)을 따르고, 표시 집계는 뒤에
   * 붙는 세부다. 둘을 다른 원천에서 읽으면 '미비' 로 거른 줄이 '완비 8/8' 로 읽힌다.
   */
  describe("서류 칸 — 앞말은 제출 상태, 집계는 세부", () => {
    const withDocs = (
      marks: Record<string, string>,
      completeness?: Completeness,
    ) => {
      const [first, ...rest] = data.schools;
      const docs = first.docs!;
      return [
        {
          ...first,
          docs: {
            ...docs,
            marks: { ...docs.marks, ...marks },
            completeness: completeness ?? docs.completeness,
          },
        },
        ...rest,
      ];
    };
    const allMarks = (mark: string) =>
      Object.fromEntries(DOC_KINDS.map((k) => [k, mark]));
    const firstRow = () => screen.getByText("가나대학교").closest("tr")!;

    it("미비 + ✕ 있음 → 'N/8 · 서류 미제출' — 건수는 ink, 미제출은 vermilion", () => {
      renderTab();
      const row = firstRow();
      const count = within(row).getByText("7/8");
      for (const c of ["tabular-nums", "text-ink"]) {
        expect(cls(count)).toContain(c);
      }
      expect(cls(within(row).getByText("신분증 미제출"))).toContain(
        "text-vermilion",
      );
      // 점(O·✕ 글자)은 더 없다.
      expect(within(row).queryByLabelText("신청서 O")).toBeNull();
      expect(within(row).queryByText("✕")).toBeNull();
    });

    it("미제출이 셋 이상이면 앞 둘 + '외 N', 전체는 title", () => {
      renderTab(
        {},
        withDocs({ 위임장: "✕", 법인인감: "✕", 신분증: "✕", 신청서: "✕" }),
      );
      const row = firstRow();
      expect(cls(within(row).getByText("4/8"))).toContain("tabular-nums");
      const miss = within(row).getByText("신청서·위임장 외 2 미제출");
      expect(cls(miss)).toContain("text-vermilion");
      expect(miss).toHaveAttribute(
        "title",
        "신청서·위임장·법인인감·신분증 미제출",
      );
    });

    it("표시는 다 O 인데 제출 상태가 미비 → '8/8 · 미비' (vermilion), 완비라 하지 않는다", () => {
      renderTab({}, withDocs(allMarks("O"), "미비"));
      const row = firstRow();
      expect(cls(within(row).getByText("8/8"))).toContain("tabular-nums");
      expect(cls(within(row).getByText("미비"))).toContain("text-vermilion");
      expect(within(row).queryByText(/완비/)).toBeNull();
    });

    it("제출 상태가 완비면 표시 하나가 비어도 '완비 7/8'", () => {
      renderTab({}, withDocs({ 신분증: "" }, "완비"));
      const full = within(firstRow()).getByText("완비 7/8");
      for (const c of ["tabular-nums", "text-ink"]) {
        expect(cls(full)).toContain(c);
      }
      expect(within(firstRow()).queryByText(/미제출|미비/)).toBeNull();
    });

    it("완비 + 전부 제출('대체' 포함) → '완비 8/8'", () => {
      renderTab({}, withDocs({ 신분증: "대체" }, "완비"));
      expect(within(firstRow()).getByText("완비 8/8")).toBeInTheDocument();
    });

    it("제출 상태가 확인 안 됨이면 '확인 안 됨' (muted)", () => {
      renderTab({}, withDocs(allMarks(""), "확인 안 됨"));
      const row = firstRow();
      expect(cls(within(row).getByText("확인 안 됨"))).toContain("text-muted");
      expect(within(row).queryByText(/\/8/)).toBeNull();
    });

    it("_서류 줄이 없으면 '확인 안 됨' (muted)", () => {
      const [first, ...rest] = data.schools;
      renderTab({}, [{ ...first, docs: null }, ...rest]);
      const none = within(firstRow()).getByText("확인 안 됨");
      expect(cls(none)).toContain("text-muted");
    });
  });

  it("표 — 단계·회선·서류 요약·PDF", () => {
    renderTab();
    const row = screen.getByText("가나대학교").closest("tr")!;
    expect(within(row).getByText("접수")).toBeInTheDocument();
    expect(cls(within(row).getByText("2"))).toContain("tabular-nums");
    expect(within(row).getByText("7/8")).toBeInTheDocument();
    const link = within(row).getByRole("link", { name: /PDF/ });
    expect(link).toHaveAttribute("href", data.schools[0].pdfs[0].webUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    const row2 = screen.getByText("다라대학교").closest("tr")!;
    expect(within(row2).getAllByText("PDF 없음")).toHaveLength(2); // 단계 + PDF 칸
    expect(within(row2).queryByRole("link")).toBeNull();
  });

  it("행 호버·선택 표준", () => {
    params = new URLSearchParams("tab=schools&school=1");
    renderTab();
    const selected = screen.getByRole("row", { name: /가나대학교/ });
    expect(cls(selected)).toContain("hover:bg-line-soft");
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(cls(selected)).toContain("border-vermilion");
    expect(cls(selected)).toContain("bg-vermilion/10");
    expect(cls(selected)).toContain("text-vermilion");
    const other = screen.getByText("다라대학교").closest("tr")!;
    expect(other).toHaveAttribute("aria-selected", "false");
    expect(cls(other)).toContain("border-line-soft");
  });

  it("행 클릭 → 서버 왕복 없이 바로 인스펙터", () => {
    const replace = vi.spyOn(window.history, "replaceState");
    renderTab();
    fireEvent.click(screen.getByText("다라대학교"));
    expect(
      screen.getByRole("heading", { name: "다라대학교" }),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(String(replace.mock.calls.at(-1)![2])).toContain("school=2");
    replace.mockRestore();
  });

  it("필터 — 단계·서류 select, 확인 필요만", () => {
    renderTab();
    const stage = screen.getByLabelText("단계 필터") as HTMLSelectElement;
    const values = Array.from(stage.options)
      .map((o) => o.value)
      .filter(Boolean);
    expect(values).toEqual([...STAGE_OPTIONS]);
    fireEvent.change(stage, { target: { value: "접수" } });
    expect(lastQuery().get("stage")).toBe("접수");
    fireEvent.change(screen.getByLabelText("서류 필터"), {
      target: { value: "미비" },
    });
    expect(lastQuery().get("docs")).toBe("미비");
    fireEvent.click(screen.getByLabelText("확인 필요만"));
    expect(lastQuery().get("check")).toBe("1");
  });

  it("필터가 바뀌면 page 를 지운다", () => {
    params = new URLSearchParams("tab=schools&page=2");
    renderTab({ page: 2 });
    fireEvent.change(screen.getByLabelText("단계 필터"), {
      target: { value: "접수" },
    });
    expect(lastQuery().get("page")).toBeNull();
  });

  it("확인 필요만 해제 → check 제거", () => {
    params = new URLSearchParams("tab=schools&check=1");
    renderTab({ checkOnly: true });
    fireEvent.click(screen.getByLabelText("확인 필요만"));
    expect(lastQuery().get("check")).toBeNull();
  });

  it("결과 없음 문구", () => {
    renderTab({}, []);
    expect(screen.getByText("조건에 맞는 학교가 없습니다")).toBeInTheDocument();
  });

  it("?school 딥링크면 인스펙터가 열리고 닫으면 ?school 을 지운다", () => {
    const replace = vi.spyOn(window.history, "replaceState");
    params = new URLSearchParams("tab=schools&school=1");
    renderTab();
    expect(
      screen.getByRole("heading", { name: "가나대학교" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      new URL(
        String(replace.mock.calls.at(-1)![2]),
        "http://x",
      ).searchParams.has("school"),
    ).toBe(false);
    replace.mockRestore();
  });
});
