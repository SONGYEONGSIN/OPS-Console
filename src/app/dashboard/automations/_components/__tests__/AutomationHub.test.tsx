import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AutomationHub } from "../AutomationHub";
import type { AutomationStatus } from "@/features/automations/types";

const base: AutomationStatus = {
  id: "insights-collect",
  label: "인사이트 영상 수집",
  description: "설명",
  scheduleInfo: "매일 08:00",
  cooldownMinutes: 60,
  lastRunAt: null,
  cooldownRemainingMinutes: 0,
  enabled: false,
};

describe("AutomationHub", () => {
  it("잡 label과 스케줄을 렌더한다", () => {
    render(<AutomationHub statuses={[base]} />);
    expect(screen.getByText("인사이트 영상 수집")).toBeInTheDocument();
    expect(screen.getByText(/매일 08:00/)).toBeInTheDocument();
  });

  it("enabled=false면 '지금 실행' 버튼이 활성", () => {
    render(<AutomationHub statuses={[base]} />);
    expect(screen.getByRole("button", { name: /지금 실행/ })).toBeEnabled();
  });

  it("enabled=true면 '자동 실행 중' 표시 (수동 비활성)", () => {
    render(<AutomationHub statuses={[{ ...base, enabled: true }]} />);
    expect(screen.getByText(/자동 실행 중/)).toBeInTheDocument();
  });

  it("자동 실행 토글 버튼이 있다", () => {
    render(<AutomationHub statuses={[base]} />);
    expect(screen.getByRole("button", { name: /자동 실행/ })).toBeInTheDocument();
  });

  it("쿨다운 중(enabled=false)이면 잔여 분을 표시한다", () => {
    render(<AutomationHub statuses={[{ ...base, cooldownRemainingMinutes: 31 }]} />);
    expect(screen.getByText(/31분/)).toBeInTheDocument();
  });

  it("쿨다운 중 '강제 실행'을 누르면 'quota 소모 — 확인' 버튼으로 전환된다", () => {
    render(<AutomationHub statuses={[{ ...base, cooldownRemainingMinutes: 31 }]} />);
    fireEvent.click(screen.getByRole("button", { name: /강제 실행/ }));
    expect(
      screen.getByRole("button", { name: /quota 소모 — 확인/ }),
    ).toBeInTheDocument();
  });
});
