import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterTabs } from "../FilterTabs";

const counts = {
  all: 12,
  incidents: 5,
  todos: 2,
  services: 3,
  backup: 2,
  handover: 1,
  schedule: 4,
  contracts: 6,
  notice: 1,
  receivables: 7,
};

describe("FilterTabs", () => {
  it("전체 + 9개 도메인 칩 + 각 건수 (N) 렌더 (일정·계약·공지·미수채권 포함)", () => {
    render(<FilterTabs active="all" counts={counts} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /전체.*12/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /서비스.*3/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /내 할 일.*2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /사고.*5/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^백업 \(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^인수인계 \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^일정 \(4\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^계약 \(6\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^공지 \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^미수채권 \(7\)/ })).toBeInTheDocument();
  });

  it("칩 순서: 전체 → 서비스 → 내 할 일 → 사고 → 백업 → 인수인계 → 일정 → 계약 → 공지 → 미수채권", () => {
    const { container } = render(
      <FilterTabs active="all" counts={counts} onChange={() => {}} />,
    );
    const labels = Array.from(container.querySelectorAll("button")).map(
      (b) => (b.textContent ?? "").replace(/\s*\(\d+\)\s*$/, "").trim(),
    );
    expect(labels).toEqual([
      "전체",
      "서비스",
      "내 할 일",
      "사고",
      "백업",
      "인수인계",
      "일정",
      "계약",
      "공지",
      "미수채권",
    ]);
  });

  it("active 탭은 굵게 + ink text + vermilion 밑줄 (표준 밑줄형 탭)", () => {
    render(<FilterTabs active="incidents" counts={counts} onChange={() => {}} />);
    const tab = screen.getByRole("button", { name: /사고/ });
    expect(tab.className).toMatch(/font-bold/);
    expect(tab.className).toMatch(/text-ink/);
    // active 밑줄 표식 (vermilion)
    expect(tab.querySelector("span[aria-hidden]")?.className).toMatch(
      /bg-vermilion/,
    );
  });

  it("inactive 탭은 transparent + muted text", () => {
    render(<FilterTabs active="incidents" counts={counts} onChange={() => {}} />);
    const tab = screen.getByRole("button", { name: /^전체/ });
    expect(tab.className).toMatch(/bg-transparent/);
    expect(tab.className).toMatch(/text-muted/);
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
