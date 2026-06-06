import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryTabs } from "../CategoryTabs";

describe("CategoryTabs", () => {
  it("모든 카테고리를 탭 버튼으로 렌더 + 활성 탭 강조", () => {
    render(<CategoryTabs active="contract" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "계약" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "작업" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "정산" })).toBeInTheDocument();
    // 활성 탭은 aria-current
    expect(screen.getByRole("button", { name: "계약" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("탭 클릭 시 onChange(key) 호출", () => {
    const onChange = vi.fn();
    render(<CategoryTabs active="contract" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "작업" }));
    expect(onChange).toHaveBeenCalledWith("work");
  });
});
