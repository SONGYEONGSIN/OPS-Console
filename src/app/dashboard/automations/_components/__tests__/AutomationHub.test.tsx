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
};

describe("AutomationHub", () => {
  it("잡 label과 스케줄을 렌더한다", () => {
    render(<AutomationHub statuses={[base]} />);
    expect(screen.getByText("인사이트 영상 수집")).toBeInTheDocument();
    expect(screen.getByText(/매일 08:00/)).toBeInTheDocument();
  });

  it("쿨다운 0이면 '지금 실행' 버튼", () => {
    render(<AutomationHub statuses={[base]} />);
    expect(screen.getByRole("button", { name: /지금 실행/ })).toBeInTheDocument();
  });

  it("쿨다운 진행 중이면 잔여 분을 표시한다", () => {
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
