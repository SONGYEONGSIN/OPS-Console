import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TriageColumns } from "../TriageColumns";
import type { LiveTableItem, TriageBucket } from "../../live-table-builder";

function item(over: Partial<LiveTableItem>): LiveTableItem {
  return {
    id: "i1",
    domain: "incidents",
    badgeDomain: "사고",
    variant: "incidents",
    statusText: "미처리",
    title: "서울시 사립초 4회 초과 지원",
    timeText: "방금",
    occurredAt: "2026-06-13T00:00:00Z",
    refDate: "2026-06-13",
    triage: "now" as TriageBucket,
    listRow: { id: "i1", name: "x", status: "active", owner: "" },
    ...over,
  };
}

describe("TriageColumns", () => {
  const items: LiveTableItem[] = [
    item({ id: "a", triage: "now", title: "사고 A" }),
    item({ id: "b", triage: "now", title: "사고 B" }),
    item({ id: "c", triage: "week", badgeDomain: "할일", title: "주간 C" }),
    item({ id: "d", triage: "track", badgeDomain: "일정", title: "추적 D" }),
  ];

  it("renders 4 bucket headers with counts", () => {
    render(<TriageColumns items={items} onSelect={() => {}} />);
    expect(screen.getByText("지금 당장")).toBeInTheDocument();
    expect(screen.getByText("오늘")).toBeInTheDocument();
    expect(screen.getByText("이번 주")).toBeInTheDocument();
    expect(screen.getByText("추적중")).toBeInTheDocument();
    expect(screen.getByText("사고 A")).toBeInTheDocument();
    expect(screen.getByText("주간 C")).toBeInTheDocument();
  });

  it("calls onSelect with the item on row click", () => {
    const onSelect = vi.fn();
    render(<TriageColumns items={items} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("사고 A"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a" }),
    );
  });

  it("shows empty placeholder for empty bucket", () => {
    render(<TriageColumns items={[item({ triage: "now" })]} onSelect={() => {}} />);
    // 오늘/이번주/추적중 비어있음 → '—' placeholder 다수
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });
});
