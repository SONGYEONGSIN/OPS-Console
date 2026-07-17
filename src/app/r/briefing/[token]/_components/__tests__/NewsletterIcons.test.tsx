import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  WizardHatIcon,
  ScrollIcon,
  CalendarIcon,
  AlarmIcon,
  CrystalBallIcon,
  CakeIcon,
  CameraIcon,
  ClapperIcon,
} from "../NewsletterIcons";

describe("NewsletterIcons", () => {
  const icons = [
    ["WizardHatIcon", WizardHatIcon],
    ["ScrollIcon", ScrollIcon],
    ["CalendarIcon", CalendarIcon],
    ["AlarmIcon", AlarmIcon],
    ["CrystalBallIcon", CrystalBallIcon],
    ["CakeIcon", CakeIcon],
    ["CameraIcon", CameraIcon],
    ["ClapperIcon", ClapperIcon],
  ] as const;

  it.each(icons)("%s — aria-hidden svg + currentColor 스트로크", (_, Icon) => {
    const { container } = render(<Icon className="h-6 w-6" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
    expect(svg!.getAttribute("stroke")).toBe("currentColor");
    expect(svg!.getAttribute("class")).toContain("h-6");
  });
});
