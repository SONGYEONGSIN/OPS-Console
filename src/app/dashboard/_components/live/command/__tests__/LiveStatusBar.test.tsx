import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { LiveStatusBar } from "../LiveStatusBar";
import type { HealthGatewayItem } from "../HealthGateway";
import type { ConsoleLogEntry } from "../../mock-log-pool";

const healthItems: HealthGatewayItem[] = [
  { label: "YouTube API Quota", tone: "ok", detail: "~700 units/day" },
  { label: "Cron 자동화 엔진", tone: "warn", detail: "77시간 전 (지연)" },
];
const logLines: ConsoleLogEntry[] = [
  { text: "[NAV] 김지나 — 사고 보고 진입", type: "info" },
];

describe("LiveStatusBar (상단 고정)", () => {
  it("시스템 헬스 + 로그 티커 + LIVE 렌더", () => {
    render(<LiveStatusBar healthItems={healthItems} logLines={logLines} />);
    expect(screen.getByText("시스템 날씨")).toBeInTheDocument();
    expect(screen.getByText("김지나 — 사고 보고 진입")).toBeInTheDocument();
    expect(screen.getByText(/LIVE/)).toBeInTheDocument();
  });

  it("상단 sticky 컨테이너", () => {
    const { container } = render(
      <LiveStatusBar healthItems={[]} logLines={[]} />,
    );
    const box = container.firstElementChild as HTMLElement;
    expect(box.className).toMatch(/sticky/);
    expect(box.className).toMatch(/top-0/);
  });
});
