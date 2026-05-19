import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HudShell } from "../HudShell";

describe("HudShell", () => {
  it("3 zone (left/center/right) + header 모두 렌더", () => {
    render(
      <HudShell
        header={<div>HEADER</div>}
        left={<div>LEFT</div>}
        center={<div>CENTER</div>}
        right={<div>RIGHT</div>}
      />,
    );
    expect(screen.getByText("HEADER")).toBeInTheDocument();
    expect(screen.getByText("LEFT")).toBeInTheDocument();
    expect(screen.getByText("CENTER")).toBeInTheDocument();
    expect(screen.getByText("RIGHT")).toBeInTheDocument();
    expect(screen.getByTestId("hud-left")).toBeInTheDocument();
    expect(screen.getByTestId("hud-center")).toBeInTheDocument();
    expect(screen.getByTestId("hud-right")).toBeInTheDocument();
  });

  it("ticker prop 있으면 footer 렌더", () => {
    render(
      <HudShell
        header={<div>H</div>}
        left={<div>L</div>}
        center={<div>C</div>}
        right={<div>R</div>}
        ticker={<div>TICKER</div>}
      />,
    );
    expect(screen.getByText("TICKER")).toBeInTheDocument();
    expect(screen.getByTestId("hud-ticker")).toBeInTheDocument();
  });

  it("ticker prop 없으면 footer 미렌더", () => {
    render(
      <HudShell
        header={<div>H</div>}
        left={<div>L</div>}
        center={<div>C</div>}
        right={<div>R</div>}
      />,
    );
    expect(screen.queryByTestId("hud-ticker")).toBeNull();
  });
});
