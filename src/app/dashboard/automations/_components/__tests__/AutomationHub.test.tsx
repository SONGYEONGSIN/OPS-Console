import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/features/automations/actions", () => ({
  getJobRunLogAction: vi.fn(),
  runAutomationAction: vi.fn(),
  setAutomationEnabledAction: vi.fn(),
}));

import { AutomationHub } from "../AutomationHub";
import {
  getJobRunLogAction,
  runAutomationAction,
  setAutomationEnabledAction,
} from "@/features/automations/actions";
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

  it("자동 실행 ON/OFF 분절 토글이 있다", () => {
    render(<AutomationHub statuses={[base]} />);
    expect(screen.getByRole("button", { name: "ON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OFF" })).toBeInTheDocument();
  });

  it("enabled=false면 OFF 세그먼트가 활성(aria-pressed)", () => {
    render(<AutomationHub statuses={[base]} />);
    expect(screen.getByRole("button", { name: "OFF" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "ON" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("enabled=true면 ON 세그먼트가 활성(aria-pressed)", () => {
    render(<AutomationHub statuses={[{ ...base, enabled: true }]} />);
    expect(screen.getByRole("button", { name: "ON" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("쿨다운 중(enabled=false)이면 잔여 분을 표시한다", () => {
    render(
      <AutomationHub statuses={[{ ...base, cooldownRemainingMinutes: 31 }]} />,
    );
    expect(screen.getByText(/31분/)).toBeInTheDocument();
  });

  it("쿨다운 중 '강제 실행'을 누르면 'quota 소모 — 확인' 버튼으로 전환된다", () => {
    render(
      <AutomationHub statuses={[{ ...base, cooldownRemainingMinutes: 31 }]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /강제 실행/ }));
    expect(
      screen.getByRole("button", { name: /quota 소모 — 확인/ }),
    ).toBeInTheDocument();
  });
});

describe("AutomationHub — 로그 인스펙터", () => {
  const match: AutomationStatus = {
    ...base,
    id: "receivables-deposit-match",
    label: "입금 매칭 자동화",
    description: "SharePoint 미수채권 매칭",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("자동화 행 클릭 시 해당 jobId로 로그를 조회하고 패널을 연다", async () => {
    (
      getJobRunLogAction as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      ok: true,
      log: { jobId: match.id, kind: "deposit-match", entries: [] },
    });

    render(<AutomationHub statuses={[match]} />);
    expect(screen.queryByText("실행 로그 · 최근 20건")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /입금 매칭 자동화/ }));

    await waitFor(() => {
      expect(getJobRunLogAction).toHaveBeenCalledWith(match.id);
    });
    expect(
      await screen.findByText("실행 로그 · 최근 20건"),
    ).toBeInTheDocument();
    expect(screen.getByText("실행 기록이 없습니다.")).toBeInTheDocument();
  });

  it("조회 실패 시 에러 메시지를 패널에 표시", async () => {
    (
      getJobRunLogAction as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      ok: false,
      message: "알 수 없는 자동화",
    });

    render(<AutomationHub statuses={[match]} />);
    fireEvent.click(screen.getByRole("button", { name: /입금 매칭 자동화/ }));

    expect(await screen.findByText("알 수 없는 자동화")).toBeInTheDocument();
  });
});

describe("AutomationHub — 비admin 게이트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("비admin이 '지금 실행' 클릭 시 알럿 + 실행 액션 미호출", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<AutomationHub statuses={[base]} isAdmin={false} />);
    fireEvent.click(screen.getByRole("button", { name: /지금 실행/ }));
    expect(alertSpy).toHaveBeenCalledWith("관리자만 실행 가능합니다.");
    expect(runAutomationAction).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("비admin이 행 클릭 시 알럿 + 로그 조회 미호출", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<AutomationHub statuses={[base]} isAdmin={false} />);
    fireEvent.click(screen.getByRole("button", { name: /인사이트 영상 수집/ }));
    expect(alertSpy).toHaveBeenCalledWith("관리자만 실행 가능합니다.");
    expect(getJobRunLogAction).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("비admin이 ON 토글 클릭 시 알럿 + 토글 액션 미호출", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<AutomationHub statuses={[base]} isAdmin={false} />);
    fireEvent.click(screen.getByRole("button", { name: "ON" }));
    expect(alertSpy).toHaveBeenCalledWith("관리자만 실행 가능합니다.");
    expect(setAutomationEnabledAction).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
