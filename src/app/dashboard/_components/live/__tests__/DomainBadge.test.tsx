import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DomainBadge, type BadgeDomain } from "../DomainBadge";

const cases: [BadgeDomain, RegExp][] = [
  ["사고", /text-vermilion/],
  ["할일", /text-ink(?!-)/],
  ["서비스", /text-ink-muted/],
  ["백업", /text-indigo/],
  ["일정", /text-amber/],
];

describe("DomainBadge", () => {
  it.each(cases)("%s → 텍스트와 색상 클래스", (domain, classRe) => {
    const { container } = render(<DomainBadge domain={domain} />);
    expect(screen.getByText(domain)).toBeInTheDocument();
    expect(container.firstChild).toHaveProperty("className");
    expect((container.firstChild as HTMLElement).className).toMatch(classRe);
  });
});
