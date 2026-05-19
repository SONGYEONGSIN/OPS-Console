import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScopeToggle } from "../ScopeToggle";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
}));

describe("ScopeToggle", () => {
  it("'전체'와 '내것' 두 버튼 렌더", () => {
    render(<ScopeToggle mine={false} />);
    expect(screen.getByRole("button", { name: "전체" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내것" })).toBeInTheDocument();
  });

  it("mine=false면 '전체' aria-pressed=true", () => {
    render(<ScopeToggle mine={false} />);
    expect(screen.getByRole("button", { name: "전체" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("mine=true면 '내것' aria-pressed=true", () => {
    render(<ScopeToggle mine={true} />);
    expect(screen.getByRole("button", { name: "내것" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("'내것' 클릭 → router.push에 ?mine=true 포함", () => {
    pushMock.mockReset();
    render(<ScopeToggle mine={false} />);
    fireEvent.click(screen.getByRole("button", { name: "내것" }));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("mine=true"));
  });
});
