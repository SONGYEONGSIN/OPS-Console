import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchBox } from "../SearchBox";

// 도메인 동적 검색은 server action — 단위 테스트에선 빈 결과로 mock (메뉴 검색만 검증)
vi.mock("@/features/search/action", () => ({
  searchAllAction: vi.fn().mockResolvedValue({
    services: [],
    contacts: [],
    incidents: [],
    handover: [],
  }),
}));

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

  it("메뉴·도메인 매치 0건이면 '검색 결과 없음'", () => {
    render(<SearchBox />);
    const input = screen.getByPlaceholderText(/검색/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "zzz존재안함" } });
    expect(screen.getByText(/검색 결과 없음/)).toBeInTheDocument();
  });
});
