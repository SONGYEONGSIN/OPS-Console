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

  it("구분 카드 — 공통 KpiCard, 누르면 ?gubun", () => {
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
    const card = screen.getByRole("button", { name: /4년제/ });
    const value = within(card).getByText("2");
    expect(value.className).toContain("text-2xl");
    expect(value.className).toContain("tabular-nums");
    expect(within(card).getByText("곳")).toBeInTheDocument();
    expect(value.closest("div.border")!.className).toContain("bg-situation-bg");
    expect(
      within(card).getByText("회선 5 · 서류 미비 1 · 확인 1"),
    ).toBeInTheDocument();
    fireEvent.click(card);
    expect(lastQuery().get("gubun")).toBe("4년제");
  });

  it("선택된 카드는 aria-pressed + vermilion 테두리, 다시 누르면 해제", () => {
    params = new URLSearchParams("tab=schools&gubun=4년제");
    renderTab({ gubun: "4년제" });
    const card = screen.getByRole("button", { name: /4년제/ });
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(card.className).toContain("ring-vermilion");
    const other = screen.getByRole("button", { name: /전문대학/ });
    expect(other).toHaveAttribute("aria-pressed", "false");
    expect(other.className).not.toContain("ring-vermilion");
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
      new URL(String(replace.mock.calls.at(-1)![2]), "http://x").searchParams.has("school"),
    ).toBe(false);
    replace.mockRestore();
  });
});
