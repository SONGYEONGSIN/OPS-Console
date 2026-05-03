import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchBox } from "../SearchBox";

describe("SearchBox", () => {
  it("placeholder 텍스트 노출", () => {
    render(<SearchBox />);
    expect(
      screen.getByPlaceholderText(/서비스, 배치, 점검 항목 검색/),
    ).toBeInTheDocument();
  });

  it("입력 전에는 드롭다운 hidden", () => {
    render(<SearchBox />);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("'pims' 입력 시 드롭다운 결과 노출", () => {
    render(<SearchBox />);
    const input = screen.getByPlaceholderText(/검색/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "pims" } });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText(/PIMS/)).toBeInTheDocument();
  });

  it("결과 항목은 /dashboard/<slug> 링크", () => {
    const { container } = render(<SearchBox />);
    const input = screen.getByPlaceholderText(/검색/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "pims" } });
    expect(container.querySelector('a[href="/dashboard/pims"]')).not.toBeNull();
  });

  it("ESC 누르면 드롭다운 닫힘", () => {
    render(<SearchBox />);
    const input = screen.getByPlaceholderText(/검색/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "정산" } });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("매치 0건이면 'no results' 안내", () => {
    render(<SearchBox />);
    const input = screen.getByPlaceholderText(/검색/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "zzzzz존재안함" } });
    expect(screen.getByText(/검색 결과 없음|결과 없음/)).toBeInTheDocument();
  });

  it("단축키 라벨 노출 (Ctrl+K 또는 ⌘K)", () => {
    render(<SearchBox />);
    expect(
      screen.getByText(/^(⌘K|Ctrl\+K)$/),
    ).toBeInTheDocument();
  });
});
