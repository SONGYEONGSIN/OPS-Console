import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListSearch } from "../ListSearch";

describe("ListSearch", () => {
  it("입력값 노출 + onChange 호출", () => {
    const onChange = vi.fn();
    render(<ListSearch value="abc" onChange={onChange} placeholder="검색" />);
    const input = screen.getByPlaceholderText("검색");
    expect(input).toHaveValue("abc");
    fireEvent.change(input, { target: { value: "abcd" } });
    expect(onChange).toHaveBeenCalledWith("abcd");
  });

  it("placeholder default — 쿼리 입력…", () => {
    render(<ListSearch value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("쿼리 입력…")).toBeInTheDocument();
  });

  it("돋보기 SVG icon 렌더", () => {
    const { container } = render(<ListSearch value="" onChange={vi.fn()} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("aria-label 검색 + type=search", () => {
    render(<ListSearch value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText("검색");
    expect(input.getAttribute("type")).toBe("search");
  });
});
