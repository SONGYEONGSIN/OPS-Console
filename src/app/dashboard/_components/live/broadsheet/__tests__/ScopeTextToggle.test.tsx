import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
}));

import { ScopeTextToggle } from "../ScopeTextToggle";

describe("ScopeTextToggle", () => {
  beforeEach(() => pushMock.mockClear());

  it("'전체'와 '내 담당' 버튼을 렌더", () => {
    render(<ScopeTextToggle mine={false} />);
    expect(screen.getByRole("button", { name: "전체" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내 담당" })).toBeInTheDocument();
  });

  it("mine=false일 때 '전체'는 text-ink, '내 담당'은 text-muted", () => {
    render(<ScopeTextToggle mine={false} />);
    expect(
      screen.getByRole("button", { name: "전체" }).className,
    ).toMatch(/text-ink/);
    expect(
      screen.getByRole("button", { name: "내 담당" }).className,
    ).toMatch(/text-muted/);
  });

  it("mine=true일 때 '전체' 클릭 시 push가 mine=false 포함 URL로 호출", () => {
    render(<ScopeTextToggle mine={true} />);
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(pushMock).toHaveBeenCalled();
    const arg = pushMock.mock.calls[0][0] as string;
    expect(arg).toMatch(/mine=false/);
  });

  it("'내 담당' 클릭 시 push가 mine=true 명시 URL로 호출", () => {
    render(<ScopeTextToggle mine={false} />);
    fireEvent.click(screen.getByRole("button", { name: "내 담당" }));
    expect(pushMock).toHaveBeenCalled();
    const arg = pushMock.mock.calls[0][0] as string;
    expect(arg).toMatch(/mine=true/);
  });
});
