import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CriteriaModal } from "../_components/CriteriaModal";

describe("CriteriaModal", () => {
  it("행을 그대로 그리고 닫기를 부른다", () => {
    const onClose = vi.fn();
    render(
      <CriteriaModal
        rows={[
          ["No", "서류"],
          ["1", "신청서"],
        ]}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("신청서")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalled();
  });
});
