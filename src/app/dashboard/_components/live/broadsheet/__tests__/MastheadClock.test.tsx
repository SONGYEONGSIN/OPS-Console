import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MastheadClock } from "../MastheadClock";

describe("MastheadClock", () => {
  it("LIVE 텍스트를 렌더", () => {
    render(<MastheadClock />);
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("bs-live-blink 클래스를 가진 ● 점멸 마커가 존재", () => {
    const { container } = render(<MastheadClock />);
    const blink = container.querySelector(".bs-live-blink");
    expect(blink).not.toBeNull();
    expect(blink?.textContent).toBe("●");
  });
});
