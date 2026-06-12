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
    // 배경/상·좌·우 보더 제거 → 하단 괘선(border-b)만 남긴 flush 헤더
    const box = container.firstElementChild as HTMLElement;
    expect(box.className).toMatch(/border-b-2/);
    expect(box.className).toMatch(/border-line/);
    expect(box.className).not.toMatch(/bg-cream/);
  });

  it("LIVE 인디케이터는 타이틀바에서 제거(상단 status 띠로 이동)", () => {
    render(<CommandBar mine />);
    expect(screen.queryByText(/LIVE MONITOR/)).not.toBeInTheDocument();
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
