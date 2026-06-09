import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const routerPush = vi.fn();
let currentParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  usePathname: () => "/dashboard/my-todo",
  useSearchParams: () => currentParams,
}));

import { MineScopeToggle } from "../MineScopeToggle";

describe("MineScopeToggle", () => {
  beforeEach(() => {
    routerPush.mockReset();
    currentParams = new URLSearchParams();
  });

  it("param이 없으면 기본 '내것' — mineLabel이 aria-selected=true", () => {
    render(<MineScopeToggle mineLabel="내 업무" allLabel="전체 업무" />);
    expect(screen.getByRole("tab", { name: "내 업무" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "전체 업무" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("'전체' 클릭 → router.push가 mine=false 포함", () => {
    render(<MineScopeToggle mineLabel="내 업무" allLabel="전체 업무" />);
    fireEvent.click(screen.getByRole("tab", { name: "전체 업무" }));
    const arg = routerPush.mock.calls[0]?.[0] as string;
    expect(arg).toContain("mine=false");
  });

  it("?mine=false 상태에서 '내것' 클릭 → mine 파라미터 제거", () => {
    currentParams = new URLSearchParams("mine=false");
    render(<MineScopeToggle mineLabel="내 업무" allLabel="전체 업무" />);
    fireEvent.click(screen.getByRole("tab", { name: "내 업무" }));
    const arg = routerPush.mock.calls[0]?.[0] as string;
    expect(arg).not.toContain("mine=false");
  });

  it("?mine=false 상태에서 allLabel이 aria-selected=true", () => {
    currentParams = new URLSearchParams("mine=false");
    render(<MineScopeToggle mineLabel="내 업무" allLabel="전체 업무" />);
    expect(screen.getByRole("tab", { name: "전체 업무" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "내 업무" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });
});
