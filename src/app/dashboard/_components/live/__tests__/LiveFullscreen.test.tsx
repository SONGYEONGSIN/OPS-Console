import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiveFullscreen } from "../LiveFullscreen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
}));

describe("LiveFullscreen", () => {
  it("title + ScopeToggle + children 노출", () => {
    render(
      <LiveFullscreen mine={false} title="실시간 현황">
        <div>BODY</div>
      </LiveFullscreen>,
    );
    expect(screen.getByText("실시간 현황")).toBeInTheDocument();
    expect(screen.getByText("BODY")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전체" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내것" })).toBeInTheDocument();
  });

  it("기본은 fullscreen=true → fixed 컨테이너 노출", () => {
    render(
      <LiveFullscreen mine={false} title="실시간 현황">
        <div>BODY</div>
      </LiveFullscreen>,
    );
    expect(screen.getByTestId("live-fullscreen-overlay")).toBeInTheDocument();
  });

  it("닫기 X 버튼 클릭 → overlay 사라짐", () => {
    render(
      <LiveFullscreen mine={false} title="실시간 현황">
        <div>BODY</div>
      </LiveFullscreen>,
    );
    fireEvent.click(screen.getByRole("button", { name: /닫기/ }));
    expect(screen.queryByTestId("live-fullscreen-overlay")).toBeNull();
  });
});
