import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Component, type ReactNode } from "react";

const request = vi.fn();
vi.mock("@/features/sms-sender/status-refresh/actions", () => ({
  requestStatusRefresh: () => request(),
}));

import { HEADER_ACTION_CLASS } from "@/components/common/HeaderActionButton";
import type { StatusRefreshView } from "@/features/sms-sender/status-refresh/contract";
import { StatusRefreshControls } from "../_components/StatusRefreshControls";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p>경계에 걸림</p> : this.props.children;
  }
}

const view = (over: Partial<StatusRefreshView> = {}): StatusRefreshView => ({
  canRequest: true,
  active: null,
  history: [],
  loadError: null,
  ...over,
});

describe("StatusRefreshControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    request.mockResolvedValue({
      ok: true,
      message: "회사 PC 에 요청했습니다.",
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("권한이 없으면 최신화 버튼 없이 이력 버튼만", () => {
    render(<StatusRefreshControls view={view({ canRequest: false })} />);
    expect(screen.queryByRole("button", { name: "현황 최신화" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "최신화 이력" }),
    ).toBeInTheDocument();
  });

  it("진행 중이면 '최신화 진행 중' 비활성", () => {
    render(
      <StatusRefreshControls
        view={view({
          active: { status: "running", requestedAt: "2026-11-07T01:00:00Z" },
        })}
      />,
    );
    expect(screen.queryByRole("button", { name: "현황 최신화" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "최신화 진행 중" }),
    ).toBeDisabled();
  });

  it("확인을 취소하면 요청하지 않는다", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<StatusRefreshControls view={view()} />);
    fireEvent.click(screen.getByRole("button", { name: "현황 최신화" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toContain("인증 문자");
    expect(request).not.toHaveBeenCalled();
  });

  it("확인하면 요청하고 결과 문구를 보인다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<StatusRefreshControls view={view()} />);
    fireEvent.click(screen.getByRole("button", { name: "현황 최신화" }));
    expect(request).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("회사 PC 에 요청했습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("요청이 거절되면 alert 에 이유", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    request.mockResolvedValue({
      ok: false,
      error: "이미 대기/진행 중인 최신화가 있습니다. 끝나면 다시 누르세요.",
    });
    render(<StatusRefreshControls view={view()} />);
    fireEvent.click(screen.getByRole("button", { name: "현황 최신화" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "이미 대기/진행 중인 최신화가 있습니다.",
    );
  });

  it("action 이 던져도 오류 경계로 올리지 않는다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    request.mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Boundary>
        <StatusRefreshControls view={view()} />
      </Boundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: "현황 최신화" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "요청에 실패했습니다. 잠시 뒤 다시 시도하세요.",
    );
    expect(screen.queryByText("경계에 걸림")).toBeNull();
    expect(screen.getByRole("button", { name: "현황 최신화" })).toBeEnabled();
  });

  it("이력 버튼은 모달을 연다", () => {
    render(<StatusRefreshControls view={view({ canRequest: false })} />);
    fireEvent.click(screen.getByRole("button", { name: "최신화 이력" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("아직 최신화한 적이 없습니다."),
    ).toBeInTheDocument();
  });

  it("버튼 모양은 헤더 액션 표준", () => {
    render(<StatusRefreshControls view={view()} />);
    for (const name of ["현황 최신화", "최신화 이력"]) {
      expect(screen.getByRole("button", { name }).className).toBe(
        HEADER_ACTION_CLASS,
      );
    }
  });
});
