import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PerformanceStepper } from "../Stepper";

describe("PerformanceStepper", () => {
  it("4개 step 모두 렌더", () => {
    render(<PerformanceStepper currentStep={3} />);
    const stepper = screen.getByTestId("performance-stepper");
    expect(stepper.children).toHaveLength(4);
  });

  it("currentStep 미만 = done state", () => {
    render(<PerformanceStepper currentStep={3} />);
    const stepper = screen.getByTestId("performance-stepper");
    // step 1, 2 는 done (✓ 표시)
    const doneNodes = stepper.querySelectorAll('[data-state="done"]');
    expect(doneNodes).toHaveLength(2);
  });

  it("currentStep = active state (1개)", () => {
    render(<PerformanceStepper currentStep={2} />);
    const active = screen
      .getByTestId("performance-stepper")
      .querySelectorAll('[data-state="active"]');
    expect(active).toHaveLength(1);
  });

  it("currentStep=1 — 1 active + 3 locked", () => {
    render(<PerformanceStepper currentStep={1} />);
    const active = screen
      .getByTestId("performance-stepper")
      .querySelectorAll('[data-state="active"]');
    const locked = screen
      .getByTestId("performance-stepper")
      .querySelectorAll('[data-state="locked"]');
    expect(active).toHaveLength(1);
    expect(locked).toHaveLength(3);
  });

  it("step 라벨 한국어 표시", () => {
    render(<PerformanceStepper currentStep={1} />);
    expect(screen.getByText("목표설정")).toBeInTheDocument();
    expect(screen.getByText("실행계획·지표")).toBeInTheDocument();
    expect(screen.getByText("정량집계·평가")).toBeInTheDocument();
    expect(screen.getByText("발행완료")).toBeInTheDocument();
  });
});
