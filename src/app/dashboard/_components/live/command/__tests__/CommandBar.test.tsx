import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
}));

import { CommandBar } from "../CommandBar";

beforeEach(() => push.mockClear());

describe("CommandBar (타이틀바)", () => {
  it("마스트헤드 '운영부 상황실' 렌더 (text-xl font-bold)", () => {
    const { container } = render(<CommandBar mine />);
    const masthead = screen.getByText("운영부 상황실");
    expect(masthead).toBeInTheDocument();
    expect(masthead.className).toMatch(/text-xl/);
    expect(masthead.className).toMatch(/font-bold/);
    // 컨테이너 border + bg-cream
    const box = container.firstElementChild as HTMLElement;
    expect(box.className).toMatch(/border-line/);
    expect(box.className).toMatch(/bg-cream/);
  });

  it("LIVE 인디케이터 렌더", () => {
    render(<CommandBar mine />);
    expect(screen.getByText(/LIVE MONITOR/)).toBeInTheDocument();
  });

  it("전체/내 담당 세그먼트 토글 렌더", () => {
    render(<CommandBar mine />);
    expect(screen.getByRole("button", { name: "전체" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내 담당" })).toBeInTheDocument();
  });

  it("mine=true → '내 담당' active(bg-ink text-cream)", () => {
    render(<CommandBar mine />);
    const mineBtn = screen.getByRole("button", { name: "내 담당" });
    expect(mineBtn.className).toMatch(/bg-ink/);
    expect(mineBtn.className).toMatch(/text-cream/);
  });
});
