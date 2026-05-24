import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PerformanceStepper } from "../Stepper";

describe("PerformanceStepper", () => {
  it("8개 step 모두 렌더", () => {
    render(<PerformanceStepper currentStep={3} />);
    const stepper = screen.getByTestId("performance-stepper");
    expect(stepper.children).toHaveLength(8);
  });

  it("currentStep 미만 = done state", () => {
    render(<PerformanceStepper currentStep={4} />);
    const stepper = screen.getByTestId("performance-stepper");
    // step 1, 2, 3 는 done (✓ 표시)
    const doneNodes = stepper.querySelectorAll('[data-state="done"]');
    expect(doneNodes).toHaveLength(3);
  });

  it("currentStep = active state (1개)", () => {
    render(<PerformanceStepper currentStep={5} />);
    const active = screen
      .getByTestId("performance-stepper")
      .querySelectorAll('[data-state="active"]');
    expect(active).toHaveLength(1);
  });

  it("currentStep 초과 = locked state", () => {
    render(<PerformanceStepper currentStep={3} />);
    const locked = screen
      .getByTestId("performance-stepper")
      .querySelectorAll('[data-state="locked"]');
    // step 4..8 = 5개 locked
    expect(locked).toHaveLength(5);
  });

  it("currentStep=1 — 첫 step만 active, 1..7 모두 locked X (실제 1 active + 7 locked)", () => {
    render(<PerformanceStepper currentStep={1} />);
    const active = screen
      .getByTestId("performance-stepper")
      .querySelectorAll('[data-state="active"]');
    const locked = screen
      .getByTestId("performance-stepper")
      .querySelectorAll('[data-state="locked"]');
    expect(active).toHaveLength(1);
    expect(locked).toHaveLength(7);
  });

  it("step 라벨 한국어 표시 (목표설정/실행계획/...)", () => {
    render(<PerformanceStepper currentStep={1} />);
    expect(screen.getByText("목표설정")).toBeInTheDocument();
    expect(screen.getByText("실행계획")).toBeInTheDocument();
    expect(screen.getByText("종합평가")).toBeInTheDocument();
    expect(screen.getByText("완료")).toBeInTheDocument();
  });
});
