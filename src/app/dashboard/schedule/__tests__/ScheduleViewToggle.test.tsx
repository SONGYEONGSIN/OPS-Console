import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  usePathname: () => "/dashboard/schedule",
  useSearchParams: () => new URLSearchParams(),
}));

import { ScheduleViewToggle } from "../ScheduleViewToggle";

describe("ScheduleViewToggle", () => {
  beforeEach(() => {
    routerPush.mockReset();
  });

  it("view=list 상태에서 '달력' 클릭 → URL view=calendar로 push", () => {
    render(<ScheduleViewToggle view="list" />);
    fireEvent.click(screen.getByRole("tab", { name: "달력" }));
    expect(routerPush).toHaveBeenCalledWith(
      expect.stringContaining("view=calendar"),
      expect.anything(),
    );
  });

  it("view=calendar 상태에서 '목록' 클릭 → URL view=list로 push (month 제거)", () => {
    render(<ScheduleViewToggle view="calendar" />);
    fireEvent.click(screen.getByRole("tab", { name: "목록" }));
    const arg = routerPush.mock.calls[0]?.[0] as string;
    expect(arg).toContain("view=list");
    expect(arg).not.toContain("month=");
  });

  it("같은 view 클릭 시 router.push 호출 안 함", () => {
    render(<ScheduleViewToggle view="calendar" />);
    fireEvent.click(screen.getByRole("tab", { name: "달력" }));
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("aria-selected가 현재 view와 일치", () => {
    render(<ScheduleViewToggle view="list" />);
    expect(screen.getByRole("tab", { name: "목록" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "달력" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });
});
