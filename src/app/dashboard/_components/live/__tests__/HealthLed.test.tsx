import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { HealthLed } from "../HealthLed";

describe("HealthLed", () => {
  it("variant=green → bg-green-light", () => {
    const { container } = render(<HealthLed variant="green" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/bg-green-light/);
  });

  it("variant=vermilion → bg-vermilion", () => {
    const { container } = render(<HealthLed variant="vermilion" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/bg-vermilion/);
  });

  it("variant=amber → bg-amber", () => {
    const { container } = render(<HealthLed variant="amber" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/bg-amber/);
  });

  it("flicker=true → animate-[led-flicker_...] 클래스", () => {
    const { container } = render(<HealthLed variant="vermilion" flicker />);
    expect((container.firstChild as HTMLElement).className).toMatch(/animate-\[led-flicker_/);
  });

  it("flicker 기본 false → flicker 클래스 없음", () => {
    const { container } = render(<HealthLed variant="green" />);
    expect((container.firstChild as HTMLElement).className).not.toMatch(/animate-\[led-flicker_/);
  });
});
