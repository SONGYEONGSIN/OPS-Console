import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Lede } from "../Lede";

const sample = {
  lede: [
    "현재 긴급 3건",
    "결제 게이트웨이 응답 350ms 추이 주시 중",
    "사고 보고 #INC-042 처리 대기",
  ],
  urgentCount: 3,
};

describe("Lede", () => {
  it("urgentCount kicker 노출 ('현재 긴급 · N건')", () => {
    render(<Lede headline={sample} />);
    expect(screen.getByText(/현재 긴급 · 3건/)).toBeInTheDocument();
  });

  it("lede 각 사건이 별도 라인으로 노출", () => {
    render(<Lede headline={sample} />);
    expect(screen.getByText(/결제 게이트웨이 응답 350ms/)).toBeInTheDocument();
    expect(screen.getByText(/#INC-042/)).toBeInTheDocument();
  });

  it("vermilion accent 라인 (border-l-4 border-vermilion)", () => {
    const { container } = render(<Lede headline={sample} />);
    const section = container.querySelector("section");
    expect(section?.className).toMatch(/border-vermilion/);
  });

  it("urgentCount=0이어도 안전하게 렌더", () => {
    render(<Lede headline={{ lede: ["정상 운영 중"], urgentCount: 0 }} />);
    expect(screen.getByText(/현재 긴급 · 0건/)).toBeInTheDocument();
    expect(screen.getByText(/정상 운영 중/)).toBeInTheDocument();
  });
});
