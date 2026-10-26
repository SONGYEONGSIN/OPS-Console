import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";

const push = vi.fn();
let params = new URLSearchParams("tab=numbers");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/internal-admin",
  useSearchParams: () => params,
}));

import type { SenderNumber } from "@/features/sms-sender/types";
import type { NumberFilters } from "@/features/sms-sender/filters";
import { NumbersTab } from "../_components/NumbersTab";

const row = (no: number, over: Partial<SenderNumber> = {}): SenderNumber => ({
  no,
  school: "가나대학교",
  gubun: "4년제",
  number: `02-0000-000${no}`,
  digits: `0200000${String(no).padStart(4, "0")}`,
  status: "등록완료",
  registeredAt: "2026-03-02",
  docs: "완비",
  note: "",
  schoolNo: 1,
  ...over,
});

const noFilters: NumberFilters = { q: "", status: "", gubun: "", page: 1 };
const lastQuery = () =>
  new URLSearchParams(push.mock.calls.at(-1)![0].split("?")[1]);

const renderTab = (
  rows: SenderNumber[] = [
    row(1),
    row(2, { status: "서류 미비", registeredAt: null, school: "다라대학교" }),
  ],
  total = rows.length,
  filters: Partial<NumberFilters> = {},
) =>
  render(
    <NumbersTab
      rows={rows}
      total={total}
      filters={{ ...noFilters, ...filters }}
      statusOptions={["등록완료", "서류 미비"]}
      gubunOptions={["4년제", "전문대학"]}
    />,
  );

describe("NumbersTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams("tab=numbers");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("머리글 순서", () => {
    renderTab();
    expect(
      screen.getAllByRole("columnheader").map((h) => h.textContent),
    ).toEqual(["발신번호", "학교", "상태", "등록일", "제출 서류", "비고"]);
  });

  it("숫자·날짜 표기", () => {
    renderTab();
    const r1 = screen.getByText("가나대학교").closest("tr")!;
    expect(within(r1).getByText("02-0000-0001").className).toContain(
      "tabular-nums",
    );
    const r2 = screen.getByText("다라대학교").closest("tr")!;
    expect(within(r2).getByText("–")).toBeInTheDocument();
  });

  it("서류 미비 상태는 vermilion", () => {
    renderTab();
    expect(
      screen.getByText("서류 미비", { selector: "td" }).className,
    ).toContain("text-vermilion");
    expect(
      screen.getByText("등록완료", { selector: "td" }).className,
    ).not.toContain("text-vermilion");
  });

  it("검색창 placeholder 와 디바운스", () => {
    vi.useFakeTimers();
    renderTab();
    const input = screen.getByPlaceholderText(
      "발신번호 또는 학교명 — 하이픈 없이도",
    );
    fireEvent.change(input, { target: { value: "0200" } });
    expect(push).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(lastQuery().get("q")).toBe("0200");
  });

  it("상태·구분 select 는 받은 옵션", () => {
    renderTab();
    const status = screen.getByLabelText("상태 필터");
    expect(
      within(status)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["상태 전체", "등록완료", "서류 미비"]);
    const gubun = screen.getByLabelText("구분 필터");
    expect(
      within(gubun)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["구분 전체", "4년제", "전문대학"]);
    fireEvent.change(status, { target: { value: "서류 미비" } });
    expect(lastQuery().get("status")).toBe("서류 미비");
    fireEvent.change(gubun, { target: { value: "전문대학" } });
    expect(lastQuery().get("gubun")).toBe("전문대학");
  });

  it("건수와 페이지네이션", () => {
    renderTab([row(1)], 120);
    expect(screen.getByText("120건")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("결과 없음 문구", () => {
    renderTab([], 0);
    expect(
      screen.getByText("조건에 맞는 발신번호가 없습니다"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
