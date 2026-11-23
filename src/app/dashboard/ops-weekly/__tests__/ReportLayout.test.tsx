import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock(
  "next/navigation",
  async () => (await import("./search-params-mock")).navigationModule,
);

import { ReportLayout } from "../_components/ReportLayout";
import { WritePanelToggle } from "../_components/write-panel-toggle";
import { setUrl } from "./search-params-mock";

afterEach(cleanup);

// [특이사항] 은 각 영역 본문(표 바로 위)이 그린다 — 실제 탭처럼 본문 안에 둔다.
const areas = {
  application: (
    <>
      <WritePanelToggle />
      <p>원서 본문</p>
    </>
  ),
  pims: <p>발표 본문</p>,
  project: <p>프로젝트 본문</p>,
  leave: <p>휴가 본문</p>,
};
const tokens = (el: Element | null) => (el?.className ?? "").split(/\s+/);

describe("ReportLayout", () => {
  it("쓸 것 칸은 닫힌 채 시작한다 — 목록이 전체 폭, 칸은 마운트된 채 hidden", () => {
    setUrl("?week=2026-11-16&tab=application");
    const { container } = render(
      <ReportLayout areas={areas} panel={<p>쓸 칸</p>} />,
    );
    expect(tokens(container.firstElementChild)).not.toContain(
      "lg:grid-cols-[minmax(0,1fr)_360px]",
    );
    const aside = container.querySelector('aside[aria-label="쓸 것"]');
    expect(aside).toHaveAttribute("hidden");
    expect(
      screen.getByRole("button", { name: "특이사항" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
  it("[특이사항] 을 누르면 오른쪽 칸이 열려 두 칸(minmax(0,1fr)·360px), 다시 누르면 닫힌다 — 쓰던 글은 남는다", () => {
    setUrl("?week=2026-11-16&tab=application");
    const { container } = render(
      <ReportLayout
        areas={areas}
        panel={<input aria-label="메모" />}
      />,
    );
    const btn = screen.getByRole("button", { name: "특이사항" });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(tokens(container.firstElementChild)).toContain(
      "lg:grid-cols-[minmax(0,1fr)_360px]",
    );
    const aside = screen.getByRole("complementary", { name: "쓸 것" });
    expect(aside).not.toHaveAttribute("hidden");
    fireEvent.change(screen.getByLabelText("메모"), {
      target: { value: "쓰던 글" },
    });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(aside).toHaveAttribute("hidden");
    fireEvent.click(btn);
    expect(screen.getByLabelText("메모")).toHaveValue("쓰던 글");
  });
  it("submit 을 주면 제출 탭과 그 패널이 생긴다 — 제출 탭에는 [특이사항] 이 없다", () => {
    setUrl("?week=2026-11-16&tab=submit");
    render(
      <ReportLayout areas={areas} panel={<p>쓸 칸</p>} submit={<p>제출 본문</p>} />,
    );
    const panel = screen.getByText("제출 본문").closest('[role="tabpanel"]');
    expect(panel).toHaveAttribute("id", "area-panel-submit");
    expect(panel).not.toHaveAttribute("hidden");
    expect(screen.queryByRole("button", { name: "특이사항" })).toBeNull();
  });
  it("submit 이 없으면 제출 탭도 패널도 없고, tab=submit 이면 원서접수를 보인다", () => {
    setUrl("?week=2026-11-16&tab=submit");
    render(<ReportLayout areas={areas} panel={<p>쓸 칸</p>} />);
    expect(screen.queryByRole("tab", { name: "제출" })).toBeNull();
    expect(
      screen.getByText("원서 본문").closest('[role="tabpanel"]'),
    ).not.toHaveAttribute("hidden");
  });
  it("프로젝트·TF 탭에는 [특이사항] 과 쓸 것 칸이 없다 — 그 탭의 특이사항은 본문 안이다", () => {
    setUrl("?week=2026-11-16&tab=project");
    const { container } = render(
      <ReportLayout areas={areas} panel={<p>쓸 칸</p>} />,
    );
    expect(screen.queryByRole("button", { name: "특이사항" })).toBeNull();
    expect(container.querySelector('aside[aria-label="쓸 것"]')).toHaveAttribute(
      "hidden",
    );
    expect(
      screen.getByText("프로젝트 본문").closest('[role="tabpanel"]'),
    ).not.toHaveAttribute("hidden");
  });
  it("영역 본문 넷을 모두 마운트하고 지금 영역만 보인다", () => {
    setUrl("?week=2026-11-16&tab=pims");
    render(<ReportLayout areas={areas} panel={null} />);
    expect(
      screen.getByText("발표 본문").closest('[role="tabpanel"]'),
    ).not.toHaveAttribute("hidden");
    expect(
      screen.getByText("원서 본문").closest('[role="tabpanel"]'),
    ).toHaveAttribute("hidden");
  });
  it("영역 패널은 탭과 id 로 이어진다", () => {
    setUrl("?week=2026-11-16&tab=pims");
    render(<ReportLayout areas={areas} panel={null} />);
    const panel = screen.getByText("발표 본문").closest('[role="tabpanel"]');
    expect(panel).toHaveAttribute("id", "area-panel-pims");
    expect(panel).toHaveAttribute("aria-labelledby", "area-tab-pims");
  });
  it("RF5 열린 쓸 칸 — lg 이상 KPI 높이만큼 비켜 붙고 화면보다 길면 안에서 스크롤", () => {
    setUrl("?week=2026-11-16&tab=application");
    render(<ReportLayout areas={areas} panel={<p>쓸 칸</p>} />);
    fireEvent.click(screen.getByRole("button", { name: "특이사항" }));
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
  it("[목록 | 쓰기] 전환은 없다 — 같은 [특이사항] 버튼이 좁은 화면에서도 연다", () => {
    setUrl("?week=2026-11-16&tab=application");
    render(<ReportLayout areas={areas} panel={<p>쓸 칸</p>} />);
    expect(screen.queryByRole("group", { name: "보기 전환" })).toBeNull();
  });

  it("lg 이상에서 영역 탭 줄이 KPI 줄 바로 아래에 붙는다", () => {
    setUrl("?week=2026-11-16&tab=application");
    render(<ReportLayout areas={areas} panel={<p>쓸 칸</p>} />);
    const row = screen.getByRole("tablist", { name: "영역" }).parentElement as Element;
    expect(row.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["lg:sticky", "lg:top-[var(--ops-kpi-h,0px)]", "bg-paper"]),
    );
  });
});
