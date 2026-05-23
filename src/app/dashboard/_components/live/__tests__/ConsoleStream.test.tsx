import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConsoleStream } from "../ConsoleStream";
import type { ConsoleLogEntry } from "../mock-log-pool";

const lines: ConsoleLogEntry[] = [
  { text: "[SYS] hello", type: "info" },
  { text: "[WARN] quota", type: "warn" },
  { text: "[ERR] failure", type: "err" },
];

describe("ConsoleStream", () => {
  it("title + Auto Scroll 라벨 + lines 렌더", () => {
    render(<ConsoleStream lines={lines} />);
    expect(screen.getByText("실시간 백그라운드 로그")).toBeInTheDocument();
    expect(screen.getByText("Auto Scroll")).toBeInTheDocument();
    expect(screen.getByText("[SYS] hello")).toBeInTheDocument();
    expect(screen.getByText("[WARN] quota")).toBeInTheDocument();
    expect(screen.getByText("[ERR] failure")).toBeInTheDocument();
  });
  it("줄별 type 색상 클래스 (info/warn/err)", () => {
    const { container } = render(<ConsoleStream lines={lines} />);
    const items = container.querySelectorAll("[data-console-line]");
    expect((items[0] as HTMLElement).className).toMatch(/text-console-info/);
    expect((items[1] as HTMLElement).className).toMatch(/text-console-warn/);
    expect((items[2] as HTMLElement).className).toMatch(/text-console-err/);
  });
  it("빈 lines도 박스는 렌더", () => {
    const { container } = render(<ConsoleStream lines={[]} />);
    expect(screen.getByText("실시간 백그라운드 로그")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-console-line]").length).toBe(0);
  });
  it("콘솔 영역 bg-console-bg + text-console-fg + h-[320px]", () => {
    const { container } = render(<ConsoleStream lines={lines} />);
    const consoleBox = container.querySelector("[data-console-line]")?.parentElement;
    expect(consoleBox?.className).toMatch(/bg-console-bg/);
    expect(consoleBox?.className).toMatch(/text-console-fg/);
    expect(consoleBox?.className).toMatch(/h-\[320px\]/);
  });
});
