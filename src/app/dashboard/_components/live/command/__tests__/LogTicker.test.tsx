import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ConsoleLogEntry } from "../../mock-log-pool";
import LogTicker from "../LogTicker";

const lines: ConsoleLogEntry[] = [
  { text: "[NAV] 김지나 — 사고 보고 진입", type: "info" },
  { text: "[MAIL] 미수채권 독려 발송 — 3건", type: "info" },
];

describe("LogTicker", () => {
  it("각 라인의 태그를 분리해 렌더한다", () => {
    render(<LogTicker lines={lines} />);
    expect(screen.getByText("[NAV]")).toBeInTheDocument();
    expect(screen.getByText("[MAIL]")).toBeInTheDocument();
  });

  it("각 라인의 본문 텍스트를 렌더한다", () => {
    render(<LogTicker lines={lines} />);
    expect(screen.getByText("김지나 — 사고 보고 진입")).toBeInTheDocument();
    expect(screen.getByText("미수채권 독려 발송 — 3건")).toBeInTheDocument();
  });

  it("태그를 gold 토큰 색으로 강조한다", () => {
    render(<LogTicker lines={lines} />);
    expect(screen.getByText("[NAV]").className).toContain("text-gold");
  });

  it("lines가 비어있으면 트랙을 렌더하지 않는다", () => {
    const { container } = render(<LogTicker lines={[]} />);
    expect(container.querySelector("[data-ticker-track]")).toBeNull();
  });

  it("태그가 없는 라인은 본문만 렌더한다", () => {
    render(<LogTicker lines={[{ text: "태그 없는 메시지", type: "info" }]} />);
    expect(screen.getByText("태그 없는 메시지")).toBeInTheDocument();
  });

  it("클릭하면 흐름이 멈추고(is-paused), 다시 클릭하면 재개한다", () => {
    const { container } = render(<LogTicker lines={lines} />);
    const region = screen.getByRole("button");
    const track = container.querySelector("[data-ticker-track]") as HTMLElement;

    expect(track.className).not.toContain("is-paused");
    fireEvent.click(region);
    expect(track.className).toContain("is-paused");
    expect(region).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(region);
    expect(track.className).not.toContain("is-paused");
    expect(region).toHaveAttribute("aria-pressed", "false");
  });
});
