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
        onPersist={vi.fn(async () => ({ ok: true }))}
      />,
    );
    expect(screen.getByText(/2026-05-18.*~/)).toBeInTheDocument();
    // 요일 헤더 7개 (월~일)
    expect(screen.getByText("월")).toBeInTheDocument();
    expect(screen.getByText("일")).toBeInTheDocument();
  });
});
