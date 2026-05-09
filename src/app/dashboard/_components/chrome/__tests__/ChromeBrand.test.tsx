import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChromeBrand } from "../ChromeBrand";

describe("ChromeBrand", () => {
  it("OPS Console 워드마크 + >_ 터미널 프롬프트 로고 노출", () => {
    render(<ChromeBrand />);
    expect(screen.getByText("OPS Console")).toBeInTheDocument();
    expect(screen.getByText(">_")).toBeInTheDocument();
  });
});
