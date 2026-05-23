import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterTabs } from "../FilterTabs";

const counts = { all: 12, incidents: 5, todos: 2, services: 3, backup: 2, schedule: 0 };

describe("FilterTabs", () => {
  it("6탭 + 각 건수 pill 렌더", () => {
    render(<FilterTabs active="all" counts={counts} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /전체.*12/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /사고.*5/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /내 할 일.*2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /서비스.*3/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^백업 \d/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^일정 \d/ })).toBeInTheDocument();
  });

  it("백업·일정 칩이 각각 분리되어 렌더됨", () => {
    render(<FilterTabs active="all" counts={counts} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /^백업 2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^일정 0/ })).toBeInTheDocument();
    // 기존 "백업 · 일정" 단일 칩 없음
    expect(screen.queryByRole("button", { name: /백업 · 일정/ })).toBeNull();
  });

  it("active 탭은 vermilion bg + cream text", () => {
    render(<FilterTabs active="incidents" counts={counts} onChange={() => {}} />);
    const tab = screen.getByRole("button", { name: /사고/ });
    expect(tab.className).toMatch(/bg-vermilion/);
    expect(tab.className).toMatch(/text-cream/);
  });

  it("inactive 탭은 transparent + border-line-soft", () => {
    render(<FilterTabs active="incidents" counts={counts} onChange={() => {}} />);
    const tab = screen.getByRole("button", { name: /^전체/ });
    expect(tab.className).toMatch(/bg-transparent/);
    expect(tab.className).toMatch(/border-line-soft/);
  });

  it("백업 칩 클릭 시 onChange('backup') 호출", () => {
    const fn = vi.fn();
    render(<FilterTabs active="all" counts={counts} onChange={fn} />);
    fireEvent.click(screen.getByRole("button", { name: /^백업/ }));
    expect(fn).toHaveBeenCalledWith("backup");
  });

  it("일정 칩 클릭 시 onChange('schedule') 호출", () => {
    const fn = vi.fn();
    render(<FilterTabs active="all" counts={counts} onChange={fn} />);
    fireEvent.click(screen.getByRole("button", { name: /^일정/ }));
    expect(fn).toHaveBeenCalledWith("schedule");
  });
});
