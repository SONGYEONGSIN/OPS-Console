import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toast } from "../Toast";

describe("Toast", () => {
  it("message 텍스트 + LED dot 렌더", () => {
    const { container } = render(<Toast message="[사고] Redis 세션 장애" />);
    expect(screen.getByText(/Redis 세션/)).toBeInTheDocument();
    expect(container.querySelector("[data-toast-led]")).not.toBeNull();
  });

  it("기본 → animate-[toast-in_...] 클래스", () => {
    const { container } = render(<Toast message="x" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/animate-\[toast-in_/);
  });

  it("leaving=true → animate-[toast-out_...] 클래스", () => {
    const { container } = render(<Toast message="x" leaving />);
    expect((container.firstChild as HTMLElement).className).toMatch(/animate-\[toast-out_/);
  });

  it("bg-ink + text-cream 토큰 적용", () => {
    const { container } = render(<Toast message="x" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/bg-ink(?!-)/);
    expect((container.firstChild as HTMLElement).className).toMatch(/text-cream/);
  });
});
