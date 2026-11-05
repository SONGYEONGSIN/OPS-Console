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
import type { SmsSenderData } from "@/features/sms-sender/types";
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
    expect(row.className).toContain("pt-3");
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

  it("구분 카드 — 운영리포트 '서비스' 카드처럼 한 장, 구분마다 칸 하나", () => {
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
    // 카드는 한 장 — 제목 '구분', 운영리포트 카드 면.
    const group = screen.getByRole("group", { name: "구분" });
    for (const c of [
      "flex",
      "flex-col",
      "gap-1",
      "border",
      "border-line-soft",
      "bg-situation-bg",
      "p-4",
    ]) {
      expect(group.className.split(/\s+/)).toContain(c);
    }
    const title = within(group).getByText("구분");
    expect(title.className).toBe("text-xs font-medium text-muted");

    // 칸은 구분 순서 그대로, 모두 같은 카드 안.
    const cols = within(group).getAllByRole("button");
    expect(cols.map((b) => b.querySelector("div")!.textContent)).toEqual(
      gubunCards(counted.schools).map((c) => c.gubun),
    );
    const card = within(group).getByRole("button", { name: /4년제/ });
    expect(card.className).toContain("flex-1");
    const label = within(card).getByText("4년제");
    expect(label.className).toContain("text-2xs");
    expect(label.className).toContain("text-muted");
    const value = within(card).getByText("2");
    for (const c of ["text-2xl", "font-bold", "tabular-nums", "text-ink"]) {
      expect(value.className).toContain(c);
    }
    const unit = within(card).getByText("곳");
    expect(unit.className).toContain("text-2xs");
    expect(unit.className).toContain("text-muted");
    // 증감 줄 자리에 회선·서류 미비·확인 — 칸 안에.
    const stats = within(card).getByText("회선 5 · 서류 미비 1 · 확인 1");
    for (const c of ["text-xs", "text-muted", "tabular-nums"]) {
      expect(stats.className).toContain(c);
    }
    expect(within(group).queryByText("비교 불가")).toBeNull();

    // 칸 사이 세로 구분선 — 줄바꿈은 뷰포트가 아니라 카드 폭(사이드바·인스펙터가 줄인다)이
    // 정하므로 컨테이너 쿼리로 숨긴다. 다섯 칸이 한 줄에 다 들어가는 폭부터 보인다.
    const row = cols[0].parentElement!.parentElement!;
    expect(row.parentElement!.className.split(/\s+/)).toContain("@container");
    for (const c of ["flex-wrap", "@3xl:flex-nowrap"]) {
      expect(row.className.split(/\s+/)).toContain(c);
    }
    const dividers = group.querySelectorAll("div.w-px");
    expect(dividers).toHaveLength(cols.length - 1);
    for (const d of dividers) {
      for (const c of [
        "hidden",
        "@3xl:block",
        "self-stretch",
        "bg-line-soft",
      ]) {
        expect(d.className.split(/\s+/)).toContain(c);
      }
      expect(d.className).not.toContain("sm:block");
    }

    fireEvent.click(card);
    expect(lastQuery().get("gubun")).toBe("4년제");
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

  it("칸은 면(面) — 목록 호버·선택 표준, 링 없음, 다시 누르면 해제", () => {
    params = new URLSearchParams("tab=schools&gubun=4년제");
    renderTab({ gubun: "4년제" });
    const card = screen.getByRole("button", { name: /4년제/ });
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(card.className).toContain("bg-vermilion/10");
    expect(card.className).not.toContain("ring");
    expect(card.className).not.toContain("hover:bg-ink");
    expect(within(card).getByText("4년제").className).toContain(
      "text-vermilion",
    );
    const other = screen.getByRole("button", { name: /전문대학/ });
    expect(other).toHaveAttribute("aria-pressed", "false");
    expect(other.className).toContain("hover:bg-line-soft");
    expect(other.className).not.toContain("bg-vermilion/10");
    expect(other.className).not.toContain("ring");
    expect(within(other).getByText("전문대학").className).not.toContain(
      "text-vermilion",
    );
    fireEvent.click(card);
    expect(lastQuery().get("gubun")).toBeNull();
  });

  it("서류 점 — '대체' 만 대, 모르는 표시는 ? (원문은 라벨·title)", () => {
    const [first, ...rest] = data.schools;
    const odd = {
      ...first,
      docs: {
        ...first.docs!,
        marks: {
          ...first.docs!.marks,
          법인인감: "대체",
          위임장: "X",
          신분증: "×",
        },
      },
    };
    renderTab({}, [odd, ...rest]);
    const row = screen.getByText("가나대학교").closest("tr")!;
    expect(within(row).getByLabelText("법인인감 대체")).toHaveTextContent(
      /^대$/,
    );
    expect(within(row).getByLabelText("위임장 X")).toHaveTextContent(/^\?$/);
    const cross = within(row).getByLabelText("신분증 ×");
    expect(cross).toHaveTextContent(/^\?$/);
    expect(cross).toHaveAttribute("title", "×");
  });

  it("표 — 단계·회선·서류 점·PDF", () => {
    renderTab();
    const row = screen.getByText("가나대학교").closest("tr")!;
    expect(within(row).getByText("접수")).toBeInTheDocument();
    expect(within(row).getByText("2").className).toContain("tabular-nums");
    expect(within(row).getByLabelText("신청서 O")).toBeInTheDocument();
    expect(within(row).getByLabelText("신분증 ✕")).toBeInTheDocument();
    expect(
      within(row).getAllByLabelText(
        /^(신청서|위임장|이용증명원|사업자등록증|법인인감|재직증명서|신분증|위탁계약서) /,
      ),
    ).toHaveLength(8);
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
    expect(selected.className).toContain("hover:bg-line-soft");
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected.className).toContain("border-vermilion");
    expect(selected.className).toContain("bg-vermilion/10");
    expect(selected.className).toContain("text-vermilion");
    const other = screen.getByText("다라대학교").closest("tr")!;
    expect(other).toHaveAttribute("aria-selected", "false");
    expect(other.className).toContain("border-line-soft");
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
