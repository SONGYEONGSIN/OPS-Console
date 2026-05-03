import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnCallPanel } from "../OnCallPanel";

const sampleOnCall = {
  primary: { name: "송영신", team: "운영2팀", role: "팀장" },
  secondary: { name: "한효진", team: "운영1팀", role: "TL" },
};

describe("OnCallPanel", () => {
  it("1차 / 2차 운영자 이름 노출", () => {
    render(<OnCallPanel onCall={sampleOnCall} />);
    expect(screen.getByText(/송영신/)).toBeInTheDocument();
    expect(screen.getByText(/한효진/)).toBeInTheDocument();
  });

  it("팀 라벨 노출", () => {
    render(<OnCallPanel onCall={sampleOnCall} />);
    expect(screen.getByText(/운영2팀/)).toBeInTheDocument();
    expect(screen.getByText(/운영1팀/)).toBeInTheDocument();
  });

  it("primary/secondary 구분 마커 노출 ('1차' / '2차')", () => {
    render(<OnCallPanel onCall={sampleOnCall} />);
    expect(screen.getByText(/1차/)).toBeInTheDocument();
    expect(screen.getByText(/2차/)).toBeInTheDocument();
  });

  it("역할(role) 노출", () => {
    render(<OnCallPanel onCall={sampleOnCall} />);
    expect(screen.getByText(/팀장/)).toBeInTheDocument();
    expect(screen.getByText(/TL/)).toBeInTheDocument();
  });
});
