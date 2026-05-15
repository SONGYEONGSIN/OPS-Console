import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListSelect } from "../ListSelect";

describe("ListSelect", () => {
  it("placeholder option + 일반 options 노출", () => {
    render(
      <ListSelect
        value=""
        onChange={vi.fn()}
        options={["4년제", "2년제"]}
        placeholder="대학구분 전체"
        ariaLabel="대학구분 필터"
      />,
    );
    const select = screen.getByLabelText("대학구분 필터");
    expect(select).toBeInTheDocument();
    expect(screen.getByText("대학구분 전체")).toBeInTheDocument();
    expect(screen.getByText("4년제")).toBeInTheDocument();
    expect(screen.getByText("2년제")).toBeInTheDocument();
  });

  it("onChange — 선택 시 새 값 호출", () => {
    const onChange = vi.fn();
    render(
      <ListSelect
        value=""
        onChange={onChange}
        options={["A", "B"]}
        placeholder="전체"
        ariaLabel="필터"
      />,
    );
    fireEvent.change(screen.getByLabelText("필터"), {
      target: { value: "A" },
    });
    expect(onChange).toHaveBeenCalledWith("A");
  });

  it("placeholder 미지정 — 빈 옵션 없이 options만 노출", () => {
    render(
      <ListSelect
        value="A"
        onChange={vi.fn()}
        options={["A", "B"]}
        ariaLabel="순수"
      />,
    );
    expect(screen.queryByText("전체")).toBeNull();
  });
});
