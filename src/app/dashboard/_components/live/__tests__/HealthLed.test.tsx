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

  it("기본(flicker 없음) → led-pulse 애니메이션 (항상 부드러운 깜박)", () => {
    const { container } = render(<HealthLed variant="green" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/animate-\[led-pulse_/);
  });

  it("flicker=true → led-flicker 애니메이션 (강한 깜박)", () => {
    const { container } = render(<HealthLed variant="vermilion" flicker />);
    expect((container.firstChild as HTMLElement).className).toMatch(/animate-\[led-flicker_/);
  });

  it("h-2.5 w-2.5 사이즈 (10px)", () => {
    const { container } = render(<HealthLed variant="green" />);
    const className = (container.firstChild as HTMLElement).className;
    expect(className).toMatch(/h-2\.5/);
    expect(className).toMatch(/w-2\.5/);
  });

  it("variant별 glow shadow 포함 — green", () => {
    const { container } = render(<HealthLed variant="green" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/shadow-\[0_0_4px_var\(--green-light\)\]/);
  });

  it("variant별 glow shadow 포함 — vermilion", () => {
    const { container } = render(<HealthLed variant="vermilion" />);
    const className = (container.firstChild as HTMLElement).className;
    expect(className).toMatch(/shadow-\[0_0_8px_var\(--vermilion\),0_0_2px_var\(--vermilion\)\]/);
  });

  it("variant별 glow shadow 포함 — amber", () => {
    const { container } = render(<HealthLed variant="amber" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/shadow-\[0_0_4px_var\(--amber\)\]/);
  });
});
