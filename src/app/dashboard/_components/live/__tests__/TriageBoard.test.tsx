import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

import { TriageBoard } from "../TriageBoard";
import type { LiveTableItem, TriageBucket } from "../live-table-builder";

function item(id: string, triage: TriageBucket, over: Partial<LiveTableItem> = {}): LiveTableItem {
  return {
    id,
    domain: "incidents",
    badgeDomain: "사고",
    variant: "incidents",
    statusText: "미처리",
    title: `항목 ${id}`,
    timeText: "방금 전",
    occurredAt: "2026-05-23T11:55:00+09:00",
    refDate: "2026-05-23",
    triage,
    listRow: {} as never,
    ...over,
  };
}

const items: LiveTableItem[] = [
  item("a", "now"),
  item("b", "now"),
  item("c", "today"),
  item("d", "week"),
  item("e", "track"),
  item("f", "track"),
  item("g", "track"),
];

describe("TriageBoard", () => {
  it("4개 컬럼(지금 당장/오늘/이번 주/추적중) + 건수 렌더", () => {
    render(<TriageBoard items={items} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /항목 a/ })).toBeInTheDocument();
    // 컬럼 헤더 + 건수
    expect(screen.getByText("지금 당장")).toBeInTheDocument();
    expect(screen.getByText("오늘")).toBeInTheDocument();
    expect(screen.getByText("이번 주")).toBeInTheDocument();
    expect(screen.getByText("추적중")).toBeInTheDocument();
  });

  it("triage 버킷별로 항목이 해당 컬럼에 배치됨", () => {
    render(<TriageBoard items={items} onSelect={() => {}} />);
    const nowCol = screen.getByRole("region", { name: /지금 당장/ });
    expect(within(nowCol).getByText("항목 a")).toBeInTheDocument();
    expect(within(nowCol).getByText("항목 b")).toBeInTheDocument();
    const trackCol = screen.getByRole("region", { name: /추적중/ });
    expect(within(trackCol).getByText("항목 e")).toBeInTheDocument();
    expect(within(trackCol).queryByText("항목 a")).toBeNull();
  });

  it("'지금 당장' 컬럼 헤더는 vermilion 강조", () => {
    render(<TriageBoard items={items} onSelect={() => {}} />);
    const nowCol = screen.getByRole("region", { name: /지금 당장/ });
    const header = within(nowCol).getByText("지금 당장").closest("header");
    expect(header?.className).toMatch(/bg-vermilion/);
  });

  it("항목 클릭 시 onSelect(item) 호출", () => {
    const fn = vi.fn();
    render(<TriageBoard items={items} onSelect={fn} />);
    fireEvent.click(screen.getByRole("button", { name: /항목 c/ }));
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ id: "c" }));
  });

  it("빈 컬럼은 placeholder 표시", () => {
    render(<TriageBoard items={[item("x", "now")]} onSelect={() => {}} />);
    // 오늘/이번 주/추적중 컬럼은 비어 placeholder
    const todayCol = screen.getByRole("region", { name: /오늘/ });
    expect(within(todayCol).getByText("—")).toBeInTheDocument();
  });
});
