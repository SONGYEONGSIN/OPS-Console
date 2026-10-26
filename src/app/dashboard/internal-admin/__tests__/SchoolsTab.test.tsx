import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const push = vi.fn();
let params = new URLSearchParams("tab=schools");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/internal-admin",
  useSearchParams: () => params,
}));

import { parseSmsSender } from "@/features/sms-sender/parse";
import { rawSource } from "@/features/sms-sender/__tests__/fixtures";
import {
  gubunCards,
  schoolDetail,
  STAGE_OPTIONS,
  type SchoolFilters,
} from "@/features/sms-sender/filters";
import { SchoolsTab } from "../_components/SchoolsTab";

const data = parseSmsSender(rawSource());
const noFilters: SchoolFilters = {
  q: "",
  gubun: "",
  stage: "",
  docs: "",
  checkOnly: false,
  school: null,
};
const lastQuery = () =>
  new URLSearchParams(push.mock.calls.at(-1)![0].split("?")[1]);

const renderTab = (
  filters: Partial<SchoolFilters> = {},
  schools = data.schools,
) => {
  const f = { ...noFilters, ...filters };
  return render(
    <SchoolsTab
      cards={gubunCards(data.schools)}
      schools={schools}
      filters={f}
      detail={schoolDetail(data, f.school)}
    />,
  );
};

describe("SchoolsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams("tab=schools");
  });

  it("구분 카드 — 숫자 한 줄, 누르면 ?gubun", () => {
    renderTab();
    const card = screen.getByRole("button", { name: /4년제/ });
    expect(within(card).getByText("2곳")).toBeInTheDocument();
    expect(
      within(card).getByText("회선 4 · 서류 미비 0 · 확인 0"),
    ).toBeInTheDocument();
    fireEvent.click(card);
    expect(lastQuery().get("gubun")).toBe("4년제");
  });

  it("선택된 카드는 aria-pressed + vermilion, 다시 누르면 해제", () => {
    params = new URLSearchParams("tab=schools&gubun=4년제");
    renderTab({ gubun: "4년제" });
    const card = screen.getByRole("button", { name: /4년제/ });
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(card.className).toContain("border-vermilion");
    expect(card.className).toContain("bg-vermilion/10");
    fireEvent.click(card);
    expect(lastQuery().get("gubun")).toBeNull();
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
    renderTab({ school: 1 });
    const selected = screen.getByRole("row", { name: /가나대학교/ });
    expect(selected.className).toContain("hover:bg-line-soft");
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected.className).toContain("bg-vermilion/10");
    const other = screen.getByText("다라대학교").closest("tr")!;
    expect(other).toHaveAttribute("aria-selected", "false");
  });

  it("행 클릭 → ?school=No", () => {
    renderTab();
    fireEvent.click(screen.getByText("다라대학교"));
    expect(lastQuery().get("school")).toBe("2");
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

  it("detail 이 있으면 인스펙터가 열리고 닫으면 ?school 을 지운다", () => {
    params = new URLSearchParams("tab=schools&school=1");
    renderTab({ school: 1 });
    expect(
      screen.getByRole("heading", { name: "가나대학교" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(lastQuery().get("school")).toBeNull();
  });
});
