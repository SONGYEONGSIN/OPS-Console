import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";

const push = vi.fn();
let params = new URLSearchParams("tab=checks");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/internal-admin",
  useSearchParams: () => params,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} data-next-link="" {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/sms-sender/actions", () => ({
  refreshSmsSenderCache: vi.fn(),
}));

import { parseSmsSender } from "@/features/sms-sender/parse";
import { rawSource } from "@/features/sms-sender/__tests__/fixtures";
import type { CheckItem } from "@/features/sms-sender/types";
import type { CheckFilters } from "@/features/sms-sender/filters";
import { ChecksTab } from "../_components/ChecksTab";
import type { ListContext } from "../_components/SmsListShell";

const data = parseSmsSender(rawSource());
const ctx: ListContext = {
  source: {
    fileName: data.workbook.name,
    fetchedAt: data.fetchedAt,
    criteria: null,
  },
  lookup: { schools: data.schools, numbers: data.numbers, checks: data.checks },
};

const item = (no: number, over: Partial<CheckItem> = {}): CheckItem => ({
  no,
  kind: "번호 불일치",
  target: "가나대학교\n02-0000-0001",
  content: "시트와 서류의 번호가 다릅니다",
  basis: "신청서 2쪽",
  todo: "서류 재확인",
  schoolNo: 1,
  ...over,
});

const noFilters: CheckFilters = { q: "", kind: "", page: 1 };
const lastQuery = () =>
  new URLSearchParams(push.mock.calls.at(-1)![0].split("?")[1]);

const renderTab = (
  rows: CheckItem[],
  total = rows.length,
  filters: Partial<CheckFilters> = {},
) =>
  render(
    <ChecksTab
      rows={rows}
      total={total}
      scopeTotal={total}
      filters={{ ...noFilters, ...filters }}
      kindOptions={["번호 불일치", "파일 이름 미대조"]}
      ctx={ctx}
    />,
  );

describe("ChecksTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams("tab=checks");
  });
  afterEach(() => vi.useRealTimers());

  it("머리글·표준 치수와 머리의 확인 필요 · N건", () => {
    renderTab([item(1)], 23);
    const heads = screen.getAllByRole("columnheader");
    expect(heads.map((h) => h.textContent)).toEqual([
      "유형",
      "대상",
      "내용",
      "근거",
      "할 일",
    ]);
    for (const h of heads) expect(h.className).toBe("px-3 py-2");
    const heading = screen.getByRole("heading", {
      name: "확인 필요",
      level: 2,
    });
    expect(
      within(heading.closest("header")!).getByText("23건"),
    ).toBeInTheDocument();
  });

  it("검색창과 유형 select 가 한 줄, 검색은 디바운스로 ?q", () => {
    vi.useFakeTimers();
    renderTab([item(1)]);
    const input = screen.getByPlaceholderText("대상·내용 검색");
    const row = input.closest<HTMLElement>("div.px-7")!;
    expect(row.className).toContain("pt-3");
    expect(within(row).getByLabelText("유형 필터")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "가나" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(lastQuery().get("q")).toBe("가나");
  });

  it("학교가 있는 대상도 링크가 아니라 텍스트 — 행을 눌러 그 자리에서 연다", () => {
    renderTab([item(1)]);
    expect(screen.queryByRole("link")).toBeNull();
    const target = screen.getByText(/가나대학교/);
    expect(target.closest("a")).toBeNull();
    expect(target.className).toContain("whitespace-pre-line");
    expect(target.textContent).toBe("가나대학교\n02-0000-0001");
  });

  it("이어지지 않는 대상은 줄바꿈 보존 텍스트", () => {
    renderTab([item(2, { schoolNo: null, target: "미상 학교\n둘째 줄" })]);
    expect(screen.queryByRole("link")).toBeNull();
    const el = screen.getByText(/미상 학교/);
    expect(el.className).toContain("whitespace-pre-line");
    expect(el.textContent).toBe("미상 학교\n둘째 줄");
  });

  it("파일 유형 행 — 파일 이름·사유, 눌러도 인스펙터가 안 열린다", () => {
    renderTab([
      item(5, {
        kind: "파일 이름 미대조",
        target: "메모.pdf",
        content: "파일 이름이 규칙과 다릅니다",
        schoolNo: null,
      }),
    ]);
    const tr = screen.getByText("메모.pdf").closest("tr")!;
    expect(
      within(tr).getByText("파일 이름이 규칙과 다릅니다"),
    ).toBeInTheDocument();
    expect(tr.className).not.toContain("cursor-pointer");
    fireEvent.click(tr);
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });

  it("학교가 있는 행을 누르면 그 학교 인스펙터", () => {
    renderTab([item(1)]);
    const tr = screen.getByText("시트와 서류의 번호가 다릅니다").closest("tr")!;
    expect(tr.className).toContain("cursor-pointer");
    fireEvent.click(tr);
    expect(
      screen.getByRole("heading", { name: "가나대학교", level: 3 }),
    ).toBeInTheDocument();
    expect(tr).toHaveAttribute("aria-selected", "true");
    expect(push).not.toHaveBeenCalled();
  });

  it("유형 select → ?type, page 는 지운다", () => {
    params = new URLSearchParams("tab=checks&page=2");
    renderTab([item(1)]);
    const select = screen.getByLabelText("유형 필터");
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["유형 전체", "번호 불일치", "파일 이름 미대조"]);
    fireEvent.change(select, { target: { value: "파일 이름 미대조" } });
    expect(lastQuery().get("type")).toBe("파일 이름 미대조");
    expect(lastQuery().get("page")).toBeNull();
  });

  it("50건을 넘으면 페이지 넘기기, 0건이면 빈 문구", () => {
    const { unmount } = renderTab([item(1)], 60);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    unmount();
    renderTab([], 0);
    expect(screen.getByText("확인할 항목이 없습니다")).toBeInTheDocument();
  });
});
