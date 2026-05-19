import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  usePathname: () => "/dashboard/my-todo",
  useSearchParams: () => new URLSearchParams(),
}));

import { WeeklyView } from "../WeeklyView";

describe("WeeklyView", () => {
  it("주 시작 헤더 + 7 요일 헤더 + 빈 todos 표시", () => {
    render(
      <WeeklyView
        todos={[]}
        weekStartYmd="2026-05-18"
        canWrite={true}
        todayYmd="2026-05-19"
        onPersist={vi.fn(async () => ({ ok: true }))}
      />,
    );
    expect(screen.getByText(/2026-05-18.*~/)).toBeInTheDocument();
    // 요일 헤더 7개 (월~일)
    expect(screen.getByText("월")).toBeInTheDocument();
    expect(screen.getByText("일")).toBeInTheDocument();
  });

  it("todayYmd와 일치하는 셀은 data-today='true' 표시", () => {
    render(
      <WeeklyView
        todos={[]}
        weekStartYmd="2026-05-18"
        canWrite={true}
        todayYmd="2026-05-19"
        onPersist={vi.fn(async () => ({ ok: true }))}
      />,
    );
    const todayCell = screen.getByTestId("weekly-cell-2026-05-19");
    expect(todayCell.getAttribute("data-today")).toBe("true");
    const otherCell = screen.getByTestId("weekly-cell-2026-05-20");
    expect(otherCell.getAttribute("data-today")).toBe("false");
  });
});
