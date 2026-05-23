import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterTabs } from "../FilterTabs";

const counts = { all: 12, incidents: 5, todos: 2, services: 3, backup: 2, handover: 1 };

describe("FilterTabs", () => {
  it("6탭 + 각 건수 pill 렌더 (일정 제거)", () => {
    render(<FilterTabs active="all" counts={counts} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /전체.*12/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /서비스.*3/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /내 할 일.*2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /사고.*5/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^백업 \d/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^인수인계 \d/ })).toBeInTheDocument();
    // 일정 칩 부재
    expect(screen.queryByRole("button", { name: /^일정/ })).toBeNull();
  });

  it("칩 순서: 전체 → 서비스 → 내 할 일 → 사고 → 백업 → 인수인계", () => {
    const { container } = render(
      <FilterTabs active="all" counts={counts} onChange={() => {}} />,
    );
    const labels = Array.from(container.querySelectorAll("button")).map(
      (b) => (b.textContent ?? "").replace(/\s+\d+\s*$/, "").trim(),
    );
    expect(labels).toEqual(["전체", "서비스", "내 할 일", "사고", "백업", "인수인계"]);
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

  it("인수인계 칩 클릭 시 onChange('handover') 호출", () => {
    const fn = vi.fn();
    render(<FilterTabs active="all" counts={counts} onChange={fn} />);
    fireEvent.click(screen.getByRole("button", { name: /^인수인계/ }));
    expect(fn).toHaveBeenCalledWith("handover");
  });
});
