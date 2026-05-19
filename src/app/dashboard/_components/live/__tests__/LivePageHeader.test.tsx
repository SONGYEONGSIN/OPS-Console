import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LivePageHeader } from "../LivePageHeader";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
}));

describe("LivePageHeader", () => {
  it("title + LIVE 라벨 + ScopeToggle 노출", () => {
    render(<LivePageHeader mine={false} title="실시간 현황" />);
    expect(screen.getByText("실시간 현황")).toBeInTheDocument();
    expect(screen.getByText(/LIVE/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전체" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내것" })).toBeInTheDocument();
  });
});
