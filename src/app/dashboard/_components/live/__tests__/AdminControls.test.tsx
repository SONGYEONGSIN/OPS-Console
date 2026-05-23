import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminControls } from "../AdminControls";

describe("AdminControls", () => {
  it("sim=false → '시뮬레이션 활성화' + 테스트 이벤트 버튼", () => {
    render(<AdminControls sim={false} onToggleSim={() => {}} onTestEvent={() => {}} />);
    expect(screen.getByRole("button", { name: /시뮬레이션 활성화/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /테스트 이벤트 인입/ })).toBeInTheDocument();
  });

  it("sim=true → '시뮬레이션 정지' + vermilion bg", () => {
    render(<AdminControls sim={true} onToggleSim={() => {}} onTestEvent={() => {}} />);
    const btn = screen.getByRole("button", { name: /시뮬레이션 정지/ });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toMatch(/bg-vermilion/);
  });

  it("주 버튼 클릭 → onToggleSim 호출", () => {
    const fn = vi.fn();
    render(<AdminControls sim={false} onToggleSim={fn} onTestEvent={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /시뮬레이션 활성화/ }));
    expect(fn).toHaveBeenCalled();
  });

  it("보조 버튼 클릭 → onTestEvent 호출", () => {
    const fn = vi.fn();
    render(<AdminControls sim={false} onToggleSim={() => {}} onTestEvent={fn} />);
    fireEvent.click(screen.getByRole("button", { name: /테스트 이벤트 인입/ }));
    expect(fn).toHaveBeenCalled();
  });
});
