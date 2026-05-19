import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DnCountdown } from "../DnCountdown";

describe("DnCountdown", () => {
  const items = [
    { dn: "D-3", university: "건축대", service: "정시 1차" },
    { dn: "D-7", university: "서울대", service: "수시 추합" },
    { dn: "D-14", university: "고려대", service: "정시 2차" },
    { dn: "D-30", university: "한양대", service: "수시 1차" },
  ];

  it("4 카드 모두 렌더", () => {
    render(<DnCountdown items={items} />);
    expect(screen.getByText("D-3")).toBeInTheDocument();
    expect(screen.getByText("D-7")).toBeInTheDocument();
    expect(screen.getByText("D-14")).toBeInTheDocument();
    expect(screen.getByText("D-30")).toBeInTheDocument();
    expect(screen.getByText("건축대")).toBeInTheDocument();
    expect(screen.getByText("한양대")).toBeInTheDocument();
  });

  it("D-3은 vermilion 강조 (가장 임박)", () => {
    render(<DnCountdown items={items} />);
    const d3 = screen.getByText("D-3");
    expect(d3.className).toMatch(/vermilion/);
  });

  it("빈 배열 — 안내 텍스트", () => {
    render(<DnCountdown items={[]} />);
    expect(screen.getByText(/임박 일정 없음/)).toBeInTheDocument();
  });
});
