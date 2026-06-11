import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HealthGateway } from "../HealthGateway";
import type { HealthGatewayItem } from "../HealthGateway";

afterEach(cleanup);

/** 7 항목 중 1개만 warn(지연) — 나머지는 ok. */
function items(): HealthGatewayItem[] {
  return [
    { label: "YouTube API Quota", tone: "ok", detail: "~700 units/day" },
    { label: "Supabase Connection", tone: "ok", detail: "310ms" },
    { label: "Cron 자동화 엔진", tone: "warn", detail: "77시간 전 (지연)" },
    { label: "Microsoft Graph API", tone: "ok", detail: "토큰 정상" },
    { label: "SharePoint 드라이브", tone: "ok", detail: "드라이브 접근 정상" },
    { label: "Microsoft SSO", tone: "ok", detail: "Azure OAuth 활성" },
    { label: "메일 발송률 (24h)", tone: "ok", detail: "99.0% (99/100)" },
  ];
}

describe("HealthGateway", () => {
  it("warn 1개 → 요약에 비정상 항목 수 '1' 노출", () => {
    render(<HealthGateway items={items()} />);
    // ⛅ 맑음 · 1 지연
    expect(screen.getByText(/1\s*지연/)).toBeInTheDocument();
  });

  it("항목 수만큼 LED를 렌더한다 (7개)", () => {
    const { container } = render(<HealthGateway items={items()} />);
    const leds = container.querySelectorAll("[data-gateway-led]");
    expect(leds).toHaveLength(7);
  });

  it("각 LED에 label + detail title 속성을 단다", () => {
    render(<HealthGateway items={items()} />);
    const led = screen.getByTitle("Cron 자동화 엔진 — 77시간 전 (지연)");
    expect(led).toBeInTheDocument();
  });

  it("전부 ok면 ☀ 맑음 요약", () => {
    const allOk = items().map((i) => ({ ...i, tone: "ok" as const }));
    render(<HealthGateway items={allOk} />);
    expect(screen.getByText(/맑음/)).toBeInTheDocument();
    expect(screen.queryByText(/지연/)).not.toBeInTheDocument();
  });
});
