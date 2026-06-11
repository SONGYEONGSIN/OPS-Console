import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
}));

import { CommandBar } from "../CommandBar";
import type { HealthGatewayItem } from "../HealthGateway";
import type { ConsoleLogEntry } from "../../mock-log-pool";

const healthItems: HealthGatewayItem[] = [
  { label: "YouTube API Quota", tone: "ok", detail: "~700 units/day" },
  { label: "Cron 자동화 엔진", tone: "warn", detail: "77시간 전 (지연)" },
];

const logLines: ConsoleLogEntry[] = [
  { text: "[NAV] 김지나 — 사고 보고 진입", type: "info" },
];

beforeEach(() => push.mockClear());

describe("CommandBar", () => {
  it("마스트헤드 '운영부 상황실' 렌더 (text-xl font-bold)", () => {
    const { container } = render(
      <CommandBar mine healthItems={healthItems} logLines={logLines} />,
    );
    const masthead = screen.getByText("운영부 상황실");
    expect(masthead).toBeInTheDocument();
    expect(masthead.className).toMatch(/text-xl/);
    expect(masthead.className).toMatch(/font-bold/);
    // 컨테이너 border + bg-cream
    const box = container.firstElementChild as HTMLElement;
    expect(box.className).toMatch(/border-line/);
    expect(box.className).toMatch(/bg-cream/);
  });

  it("LIVE 인디케이터 렌더", () => {
    render(<CommandBar mine healthItems={healthItems} logLines={logLines} />);
    expect(screen.getByText(/LIVE MONITOR/)).toBeInTheDocument();
  });

  it("전체/내 담당 세그먼트 토글 렌더", () => {
    render(<CommandBar mine healthItems={healthItems} logLines={logLines} />);
    expect(screen.getByRole("button", { name: "전체" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내 담당" })).toBeInTheDocument();
  });

  it("mine=true → '내 담당' active(bg-ink text-cream)", () => {
    render(<CommandBar mine healthItems={healthItems} logLines={logLines} />);
    const mineBtn = screen.getByRole("button", { name: "내 담당" });
    expect(mineBtn.className).toMatch(/bg-ink/);
    expect(mineBtn.className).toMatch(/text-cream/);
  });

  it("HealthGateway 시스템 날씨 요약 렌더", () => {
    render(<CommandBar mine healthItems={healthItems} logLines={logLines} />);
    expect(screen.getByText("시스템 날씨")).toBeInTheDocument();
  });

  it("LogTicker 로그 라인 렌더", () => {
    render(<CommandBar mine healthItems={healthItems} logLines={logLines} />);
    expect(screen.getByText("김지나 — 사고 보고 진입")).toBeInTheDocument();
  });
});
