import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard/schedule",
  useSearchParams: () => new URLSearchParams(),
}));

import { CalendarToolbar } from "../CalendarToolbar";

function renderToolbar(overrides: Partial<Parameters<typeof CalendarToolbar>[0]> = {}) {
  const defaults = {
    year: 2026,
    month0: 4,
    view: "calendar" as const,
    canWrite: true,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onToday: vi.fn(),
    onViewChange: vi.fn(),
    onNewEvent: vi.fn(),
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

  it("내것|전체 세그먼트 토글 렌더 (기본 '내 일정' 선택)", () => {
    renderToolbar();
    expect(screen.getByRole("tab", { name: "내 일정" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "전체 일정" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });
});
