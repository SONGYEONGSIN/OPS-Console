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

  // 톤을 고를 수 있게 두니 한 곳이 배경 없는 버튼이 됐다(전도금대장). 같은
  // '원본 엑셀 바로가기'가 탭마다 달라 보였다. 고를 수 없게 해서 못박는다 —
  // tone 을 주면 이제 tsc 가 막는다.
  it("링크로 그려도 배경이 있다 — 이 자리 버튼은 언제나 같은 모양이다", () => {
    render(<HeaderActionButton href="https://x">엑셀</HeaderActionButton>);
    expect(screen.getByRole("link").className).toMatch(/bg-vermilion/);
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
