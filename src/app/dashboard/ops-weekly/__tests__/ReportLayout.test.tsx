import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";

vi.mock(
  "next/navigation",
  async () => (await import("./search-params-mock")).navigationModule,
);

import { ReportLayout } from "../_components/ReportLayout";
import { setUrl } from "./search-params-mock";

afterEach(cleanup);

const areas = {
  application: <p>원서 본문</p>,
  pims: <p>발표 본문</p>,
  leave: <p>휴가 본문</p>,
};
const tokens = (el: Element | null) => (el?.className ?? "").split(/\s+/);

describe("ReportLayout", () => {
  it("lg 이상 두 칸 — 왼쪽 minmax(0,1fr) · 오른쪽 360px", () => {
    setUrl("?week=2026-11-16&tab=application");
    const { container } = render(
      <ReportLayout checked={[]} areas={areas} panel={<p>쓸 칸</p>} />,
    );
    expect(tokens(container.firstElementChild)).toContain(
      "lg:grid-cols-[minmax(0,1fr)_360px]",
    );
  });
  it("영역 본문 셋을 모두 마운트하고 지금 영역만 보인다", () => {
    setUrl("?week=2026-11-16&tab=pims");
    render(<ReportLayout checked={[]} areas={areas} panel={null} />);
    expect(
      screen.getByText("발표 본문").closest('[role="tabpanel"]'),
    ).not.toHaveAttribute("hidden");
    expect(
      screen.getByText("원서 본문").closest('[role="tabpanel"]'),
    ).toHaveAttribute("hidden");
  });
  it("영역 패널은 탭과 id 로 이어진다", () => {
    setUrl("?week=2026-11-16&tab=pims");
    render(<ReportLayout checked={[]} areas={areas} panel={null} />);
    const panel = screen.getByText("발표 본문").closest('[role="tabpanel"]');
    expect(panel).toHaveAttribute("id", "area-panel-pims");
    expect(panel).toHaveAttribute("aria-labelledby", "area-tab-pims");
  });
  it("RF5 쓸 칸 — lg 이상 KPI 높이만큼 비켜 붙고 화면보다 길면 안에서 스크롤", () => {
    setUrl("?week=2026-11-16&tab=application");
    render(<ReportLayout checked={[]} areas={areas} panel={<p>쓸 칸</p>} />);
    expect(
      tokens(screen.getByRole("complementary", { name: "쓸 것" })),
    ).toEqual(
      expect.arrayContaining([
        "lg:sticky",
        "lg:top-[calc(var(--ops-kpi-h,0px)+1rem)]",
        "lg:max-h-[calc(100dvh-var(--ops-kpi-h,0px)-7rem)]",
        "lg:overflow-y-auto",
      ]),
    );
  });
  it("[목록 | 쓰기] — lg 미만 전환, 안 보이는 칸은 max-lg:hidden 이고 마운트된 채", () => {
    setUrl("?week=2026-11-16&tab=application");
    render(<ReportLayout checked={[]} areas={areas} panel={<p>쓸 칸</p>} />);
    const group = screen.getByRole("group", { name: "보기 전환" });
    expect(tokens(group)).toContain("lg:hidden");
    expect(
      tokens(screen.getByRole("complementary", { name: "쓸 것" })),
    ).toContain("max-lg:hidden");
    fireEvent.click(within(group).getByRole("button", { name: "쓰기" }));
    expect(
      within(group).getByRole("button", { name: "쓰기" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      tokens(within(group).getByRole("button", { name: "쓰기" })),
    ).toEqual(expect.arrayContaining(["bg-ink", "text-cream"]));
    expect(tokens(screen.getByText("원서 본문").closest(".min-w-0"))).toContain(
      "max-lg:hidden",
    );
    expect(
      tokens(screen.getByRole("complementary", { name: "쓸 것" })),
    ).not.toContain("max-lg:hidden");
  });
  it("RF2 [목록 | 쓰기] 를 오가도 쓸 칸 입력이 남는다", () => {
    setUrl("?week=2026-11-16&tab=application");
    render(
      <ReportLayout
        checked={[]}
        areas={areas}
        panel={<input aria-label="메모" />}
      />,
    );
    fireEvent.change(screen.getByLabelText("메모"), {
      target: { value: "쓰던 글" },
    });
    const group = screen.getByRole("group", { name: "보기 전환" });
    fireEvent.click(within(group).getByRole("button", { name: "쓰기" }));
    fireEvent.click(within(group).getByRole("button", { name: "목록" }));
    expect(screen.getByLabelText("메모")).toHaveValue("쓰던 글");
  });
});
