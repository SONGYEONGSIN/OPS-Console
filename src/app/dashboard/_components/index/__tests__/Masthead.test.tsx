import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Masthead } from "../Masthead";

const fixedNow = new Date("2026-04-30T16:42:00+09:00"); // 목요일

describe("Masthead", () => {
  it("'실시간 현황' 메인 + 'OPSROOM 일간' 메타 노출", () => {
    render(<Masthead now={fixedNow} shiftLabel="2교대 14:00–22:00" volume={214} />);
    expect(screen.getByText(/실시간 현황/)).toBeInTheDocument();
    expect(screen.getByText(/OPSROOM/)).toBeInTheDocument();
    expect(screen.getByText(/일간/)).toBeInTheDocument();
  });

  it("vol 번호 노출 (3자리 zero-pad)", () => {
    render(<Masthead now={fixedNow} shiftLabel="2교대" volume={214} />);
    expect(screen.getByText(/vol\.214/)).toBeInTheDocument();
  });

  it("vol 1자리도 zero-pad (vol.001)", () => {
    render(<Masthead now={fixedNow} shiftLabel="2교대" volume={1} />);
    expect(screen.getByText(/vol\.001/)).toBeInTheDocument();
  });

  it("발행일자 YYYY.MM.DD 포맷 노출", () => {
    render(<Masthead now={fixedNow} shiftLabel="2교대" volume={214} />);
    expect(screen.getByText(/2026\.04\.30/)).toBeInTheDocument();
  });

  it("shiftLabel prop 노출", () => {
    render(<Masthead now={fixedNow} shiftLabel="2교대 14:00–22:00" volume={214} />);
    expect(screen.getByText(/2교대 14:00–22:00/)).toBeInTheDocument();
  });

  it("'live' 인디케이터 노출", () => {
    render(<Masthead now={fixedNow} shiftLabel="2교대" volume={214} />);
    expect(screen.getByText(/live/i)).toBeInTheDocument();
  });
});
