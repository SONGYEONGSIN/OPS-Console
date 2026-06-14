import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PriorityFeed } from "../PriorityFeed";
import type { LiveTableItem } from "../../live-table-builder";

function item(id: string, badge: LiveTableItem["badgeDomain"]): LiveTableItem {
  return {
    id,
    domain: "incidents",
    badgeDomain: badge,
    variant: "incidents",
    statusText: "미처리",
    title: `항목 ${id}`,
    timeText: "방금",
    occurredAt: "2026-06-13T00:00:00Z",
    refDate: "2026-06-13",
    triage: "track",
    listRow: { id, name: `항목 ${id}`, status: "active", owner: "" },
  };
}

const items: LiveTableItem[] = [
  ...Array.from({ length: 10 }, (_, i) => item(String(i), "사고")),
  item("10", "일정"),
  item("11", "일정"),
];

describe("PriorityFeed", () => {
  it("shows first 10 of 12 with pager, advances to page 2", () => {
    render(<PriorityFeed items={items} onSelect={() => {}} />);
    expect(screen.getByText("항목 0")).toBeInTheDocument();
    expect(screen.queryByText("항목 10")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    expect(screen.getByText("항목 10")).toBeInTheDocument();
    expect(screen.queryByText("항목 0")).not.toBeInTheDocument();
  });

  it("filters by category chip and resets to page 1", () => {
    render(<PriorityFeed items={items} onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /일정 2/ }));
    expect(screen.getByText("항목 10")).toBeInTheDocument();
    expect(screen.getByText("항목 11")).toBeInTheDocument();
    expect(screen.queryByText("항목 0")).not.toBeInTheDocument();
    // 2건 → 1페이지뿐이라 페이저 숨김
    expect(screen.queryByText("1 / 2")).not.toBeInTheDocument();
  });

  it("calls onSelect on card click", () => {
    const onSelect = vi.fn();
    render(<PriorityFeed items={items} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("항목 3"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "3" }));
  });

  it("shows 전체 chip with total count", () => {
    render(<PriorityFeed items={items} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /전체 12/ })).toBeInTheDocument();
  });
});
