import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CopyButton } from "../CopyButton";

describe("CopyButton", () => {
  it("클릭 시 clipboard에 값 복사 + '복사됨' 표시", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<CopyButton value="01057371114" label="전화" />);
    fireEvent.click(screen.getByRole("button", { name: "전화 복사" }));
    expect(writeText).toHaveBeenCalledWith("01057371114");
    expect(await screen.findByText("복사됨")).toBeInTheDocument();
  });
});
