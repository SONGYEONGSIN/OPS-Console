import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LivePageHeader } from "../LivePageHeader";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
}));

describe("LivePageHeader", () => {
  beforeEach(() => pushMock.mockClear());

  it("타이틀 렌더 — 22px extrabold tracking", () => {
    const { container } = render(
      <LivePageHeader mine={false} title="실시간 운영 현황" />
    );
    const h1 = container.querySelector("h1");
    expect(h1).toBeInTheDocument();
    expect(h1?.textContent).toBe("실시간 운영 현황");
    expect(h1?.className).toMatch(/text-\[22px\]/);
    expect(h1?.className).toMatch(/font-extrabold/);
    expect(h1?.className).toMatch(/tracking-\[-0.03em\]/);
  });

  it("LIVE MONITOR 텍스트 렌더 (LiveIndicator)", () => {
    render(<LivePageHeader mine={false} title="x" />);
    expect(screen.getByText(/LIVE MONITOR/)).toBeInTheDocument();
  });

  it("LIVE MONITOR 박스는 border-vermilion + pulse dot", () => {
    const { container } = render(
      <LivePageHeader mine={false} title="x" />
    );
    // LiveIndicator는 span으로 border border-vermilion
    const indicator = container.querySelector("[class*='border-vermilion']");
    expect(indicator).toBeInTheDocument();
    // pulse dot 검증 (data-live-dot attribute)
    const dot = container.querySelector("[data-live-dot]");
    expect(dot).toBeInTheDocument();
  });

  it("세그먼트 토글: 전체/내 담당 버튼 렌더", () => {
    render(<LivePageHeader mine={false} title="x" />);
    expect(
      screen.getByRole("button", { name: "전체" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "내 담당" })
    ).toBeInTheDocument();
  });

  it("mine=false일 때 SegmentToggle의 '전체' 버튼이 active", () => {
    render(<LivePageHeader mine={false} title="x" />);
    const allButton = screen.getByRole("button", { name: "전체" });
    expect(allButton.className).toMatch(/bg-ink/);
    expect(allButton.className).toMatch(/text-cream/);
  });

  it("mine=true일 때 SegmentToggle의 '내 담당' 버튼이 active", () => {
    render(<LivePageHeader mine={true} title="x" />);
    const mineButton = screen.getByRole("button", { name: "내 담당" });
    expect(mineButton.className).toMatch(/bg-ink/);
    expect(mineButton.className).toMatch(/text-cream/);
  });

  it("헤더 border-b-2 border-ink 적용", () => {
    const { container } = render(
      <LivePageHeader mine={false} title="x" />
    );
    const header = container.querySelector("header");
    expect(header?.className).toMatch(/border-b-2/);
    expect(header?.className).toMatch(/border-ink/);
  });

  it("헤더 배경색 bg-paper 적용 (로그인 페이지와 통일)", () => {
    const { container } = render(
      <LivePageHeader mine={false} title="x" />
    );
    const header = container.querySelector("header");
    expect(header?.className).toMatch(/bg-paper/);
  });

  it("data-page-accent 요소는 제거 (예전 accent 라인)", () => {
    const { container } = render(
      <LivePageHeader mine={false} title="x" />
    );
    const accentLine = container.querySelector("[data-page-accent]");
    expect(accentLine).not.toBeInTheDocument();
  });

  it("header padding: px-6 pb-3 pt-4", () => {
    const { container } = render(
      <LivePageHeader mine={false} title="x" />
    );
    const header = container.querySelector("header");
    expect(header?.className).toMatch(/px-6/);
    expect(header?.className).toMatch(/pb-3/);
    expect(header?.className).toMatch(/pt-4/);
  });
});
