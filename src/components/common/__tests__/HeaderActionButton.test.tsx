import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeaderActionButton } from "../HeaderActionButton";

/**
 * 목록 헤더 액션 버튼.
 *
 * 표준이 **컴포넌트가 아니라 복사해 쓰는 클래스 문자열**이라 세 곳에 흩어져 있었고,
 * 결국 한 곳이 다른 치수로 들어갔다(2026-08-20 우편물 탭). 한 곳에서만 정한다.
 */
describe("HeaderActionButton", () => {
  it("표준 치수를 쓴다", () => {
    render(<HeaderActionButton>+ 새 글</HeaderActionButton>);
    const el = screen.getByRole("button", { name: "+ 새 글" });
    expect(el.className).toMatch(/px-3/);
    expect(el.className).toMatch(/py-1(?!\.)/);
    expect(el.className).toMatch(/text-xs/);
    expect(el.className).toMatch(/font-medium/);
  });

  it("기본은 솔리드 — 그 자리의 기본 액션이다", () => {
    render(<HeaderActionButton>x</HeaderActionButton>);
    expect(screen.getByRole("button").className).toMatch(/bg-vermilion/);
  });

  it("보조 액션은 아웃라인 — 솔리드가 둘이면 무엇이 주인지 흐려진다", () => {
    render(<HeaderActionButton tone="outline">x</HeaderActionButton>);
    const el = screen.getByRole("button");
    expect(el.className).toMatch(/bg-transparent/);
    expect(el.className).not.toMatch(/bg-vermilion\s/);
  });

  it("href를 주면 링크가 된다 — 새 탭으로 연다", () => {
    render(<HeaderActionButton href="https://x">엑셀</HeaderActionButton>);
    const el = screen.getByRole("link", { name: "엑셀" });
    expect(el).toHaveAttribute("href", "https://x");
    expect(el).toHaveAttribute("target", "_blank");
    expect(el).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("누르면 알린다", () => {
    const onClick = vi.fn();
    render(<HeaderActionButton onClick={onClick}>x</HeaderActionButton>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });
});
