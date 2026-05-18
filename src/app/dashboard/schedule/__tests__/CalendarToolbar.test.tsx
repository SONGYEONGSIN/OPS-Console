import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalendarToolbar } from "../CalendarToolbar";

function renderToolbar(overrides: Partial<Parameters<typeof CalendarToolbar>[0]> = {}) {
  const defaults = {
    year: 2026,
    month0: 4,
    view: "calendar" as const,
    canWrite: true,
    mineActive: false,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onToday: vi.fn(),
    onViewChange: vi.fn(),
    onNewEvent: vi.fn(),
    onToggleMine: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  render(<CalendarToolbar {...props} />);
  return props;
}

describe("CalendarToolbar", () => {
  it("year.month을 'YYYY.MM' 포맷으로 표시", () => {
    renderToolbar();
    expect(screen.getByText("2026.05")).toBeInTheDocument();
  });

  it("prev/next/today 버튼 클릭 → 해당 콜백", () => {
    const { onPrev, onNext, onToday } = renderToolbar();
    fireEvent.click(screen.getByLabelText("이전 달"));
    fireEvent.click(screen.getByLabelText("다음 달"));
    fireEvent.click(screen.getByRole("button", { name: "오늘" }));
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onToday).toHaveBeenCalledOnce();
  });

  it("view 토글 클릭 시 onViewChange(next)", () => {
    const { onViewChange } = renderToolbar({ view: "calendar" });
    fireEvent.click(screen.getByRole("tab", { name: "목록" }));
    expect(onViewChange).toHaveBeenCalledWith("list");
  });

  it("canWrite=false면 + 새 일정 버튼 hidden", () => {
    renderToolbar({ canWrite: false });
    expect(screen.queryByRole("button", { name: /\+ 새 일정/ })).toBeNull();
  });

  it("canWrite=true + 새 일정 클릭 → onNewEvent", () => {
    const { onNewEvent } = renderToolbar({ canWrite: true });
    fireEvent.click(screen.getByRole("button", { name: /\+ 새 일정/ }));
    expect(onNewEvent).toHaveBeenCalledOnce();
  });

  it("내 일정 버튼 클릭 → onToggleMine 호출", () => {
    const { onToggleMine } = renderToolbar({ mineActive: false });
    fireEvent.click(screen.getByRole("button", { name: "내 일정" }));
    expect(onToggleMine).toHaveBeenCalledOnce();
  });

  it("mineActive=true이면 aria-pressed='true'", () => {
    renderToolbar({ mineActive: true });
    expect(screen.getByRole("button", { name: "내 일정" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
