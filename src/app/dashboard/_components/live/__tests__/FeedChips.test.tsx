import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeedChips } from "../FeedChips";

describe("FeedChips", () => {
  const counts = { all: 7, incidents: 1, todos: 2, services: 2, schedule: 1, backup: 1 };
  it("전체+5개 칩 렌더 + 건수", () => {
    render(<FeedChips active="all" counts={counts} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /전체.*7/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /사고.*1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /내 할일.*2/ })).toBeInTheDocument();
  });
  it("클릭 시 onChange 호출", () => {
    const fn = vi.fn();
    render(<FeedChips active="all" counts={counts} onChange={fn} />);
    fireEvent.click(screen.getByRole("button", { name: /사고/ }));
    expect(fn).toHaveBeenCalledWith("incidents");
  });
  it("활성 칩에 aria-pressed=true", () => {
    render(<FeedChips active="services" counts={counts} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /서비스/ })).toHaveAttribute("aria-pressed", "true");
  });
});
