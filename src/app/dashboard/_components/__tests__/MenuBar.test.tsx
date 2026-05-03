import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MenuBar } from "../MenuBar";

describe("MenuBar", () => {
  it("◆ 마커 + SearchBox + 사용자 영역 노출", () => {
    render(<MenuBar />);
    expect(
      screen.getByPlaceholderText(/서비스, 배치, 점검 항목 검색/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /송영석/ })).toBeInTheDocument();
  });
});
