import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const push = vi.fn();
let params = new URLSearchParams("tab=sms&view=schools");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/internal-admin",
  useSearchParams: () => params,
}));

vi.mock("@/features/sms-sender/actions", () => ({
  refreshSmsSenderCache: vi.fn(),
}));

import { parseSmsSender } from "@/features/sms-sender/parse";
import { rawSource } from "@/features/sms-sender/__tests__/fixtures";
import { SmsListShell, type ListContext } from "../_components/SmsListShell";

const data = parseSmsSender(rawSource());
const ctx: ListContext = {
  source: {
    fileName: data.workbook.name,
    fetchedAt: data.fetchedAt,
    criteria: null,
  },
  lookup: { schools: data.schools, numbers: data.numbers, checks: data.checks },
};

const renderShell = (count = 3, scopeTotal = 5) =>
  render(
    <SmsListShell
      ctx={ctx}
      controls={<input aria-label="검색 자리" />}
      title="학교"
      count={count}
      unit="곳"
      scopeTotal={scopeTotal}
      emptyText="조건에 맞는 학교가 없습니다"
    >
      {({ selectedNo, select }) => (
        <table>
          <tbody>
            <tr>
              <td>
                <button type="button" onClick={() => select(1)}>
                  {`가나 고르기 ${selectedNo ?? "-"}`}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </SmsListShell>,
  );

describe("SmsListShell — 목록 표준 골격", () => {
  let replace: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams("tab=sms&view=schools");
    replace = vi.spyOn(window.history, "replaceState");
  });
  afterEach(() => replace.mockRestore());

  it("검색줄은 표 위 px-7 pt-3 한 줄", () => {
    renderShell();
    const row = screen.getByLabelText("검색 자리").parentElement!;
    expect(row.className).toContain("flex");
    expect(row.className).toContain("px-7");
    expect(row.className).toContain("pt-3");
  });

  it("머리 — section p-7 > header mb-4, 제목 text-xl font-bold · vermilion 건수", () => {
    renderShell();
    const heading = screen.getByRole("heading", { name: "학교", level: 2 });
    expect(heading.className).toContain("text-xl");
    expect(heading.className).toContain("font-bold");
    const header = heading.closest("header")!;
    expect(header.className).toContain("mb-4");
    expect(header.className).toContain("justify-between");
    expect(header.parentElement!.tagName).toBe("SECTION");
    expect(header.parentElement!.className).toContain("p-7");
    const count = within(header).getByText("3곳");
    expect(count.className).toContain("text-vermilion");
  });

  it("왼쪽에 전체 / 내 대학 칩, 전체 옆은 범위 밖 건수", () => {
    renderShell(3, 5);
    expect(screen.getByRole("button", { name: "전체" })).toHaveTextContent(
      "전체 (5)",
    );
    expect(screen.getByRole("button", { name: "내 대학" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("오른쪽에 현황 파일 문구 · 새로고침 · 서류 기준", () => {
    renderShell();
    const header = screen
      .getByRole("heading", { name: "학교" })
      .closest("header")!;
    expect(
      within(header).getByText("현황 파일 _261017.xlsm · 기준 09:05"),
    ).toBeInTheDocument();
    expect(
      within(header).getByRole("button", { name: "새로고침" }),
    ).toBeInTheDocument();
    expect(
      within(header).getByRole("button", { name: "서류 기준" }),
    ).toBeInTheDocument();
  });

  it("표는 overflow-x-auto 안, 0건이면 빈 문구", () => {
    const { unmount } = renderShell();
    expect(screen.getByRole("table").parentElement!.className).toContain(
      "overflow-x-auto",
    );
    unmount();
    renderShell(0);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("조건에 맞는 학교가 없습니다")).toBeInTheDocument();
  });

  it("50건을 넘으면 페이지 넘기기", () => {
    renderShell(120);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("행을 고르면 서버 왕복 없이 바로 인스펙터 — 본문이 비켜나고 주소엔 school", () => {
    const { container } = renderShell();
    expect(screen.queryByRole("heading", { name: "가나대학교" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /가나 고르기/ }));
    expect(
      screen.getByRole("heading", { name: "가나대학교" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "가나 고르기 1" }),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(String(replace.mock.calls.at(-1)![2])).toContain("school=1");
    const body = container.querySelector("section")!.parentElement!;
    expect(body.className).toContain("md:pr-[340px]");
  });

  it("?school=No 딥링크는 처음부터 열린다, 닫으면 주소에서 지운다", () => {
    params = new URLSearchParams("tab=sms&view=schools&school=1");
    const { container } = renderShell();
    expect(
      screen.getByRole("heading", { name: "가나대학교" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      new URL(String(replace.mock.calls.at(-1)![2]), "http://x").searchParams.has("school"),
    ).toBe(false);
    const body = container.querySelector("section")!.parentElement!;
    expect(body.className).not.toContain("md:pr-[340px]");
  });

  it("없는 학교 No 는 열지 않는다", () => {
    params = new URLSearchParams("tab=sms&view=schools&school=999");
    const { container } = renderShell();
    expect(screen.queryByRole("complementary", { hidden: false })).toBeNull();
    const body = container.querySelector("section")!.parentElement!;
    expect(body.className).not.toContain("md:pr-[340px]");
  });
});
