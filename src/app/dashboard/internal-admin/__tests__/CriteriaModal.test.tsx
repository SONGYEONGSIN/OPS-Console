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

  it("칸 안 줄바꿈을 그대로 보인다 — 한글은 낱말 중간에서 안 끊는다", () => {
    render(
      <CriteriaModal
        rows={[["1", "재직증명서\n사업자등록증"]]}
        onClose={vi.fn()}
      />,
    );
    const cell = screen.getByText(/재직증명서/);
    expect(cell.tagName).toBe("TD");
    expect(cell.textContent).toBe("재직증명서\n사업자등록증");
    expect(cell.className).toContain("whitespace-pre-line");
    expect(cell.className).toContain("break-keep");
    expect(cell.className).toContain("align-top");
    // 모든 칸에 걸면 표가 열을 한 글자 폭까지 줄일 수 있어 한글이 끊긴다.
    expect(cell.className).not.toContain("[overflow-wrap:anywhere]");
  });

  it("공백 없는 긴 글(URL)이 있는 칸만 아무 데서나 끊는다", () => {
    const url = "https://example.com/very/long/path/to/some/document.pdf";
    render(<CriteriaModal rows={[["1", `주소\n${url}`]]} onClose={vi.fn()} />);
    const cell = screen.getByText(/example\.com/);
    expect(cell.className).toContain("[overflow-wrap:anywhere]");
    expect(cell.className).toContain("whitespace-pre-line");
  });

  it("칸이 모자란 줄은 마지막 칸이 남은 열을 채운다", () => {
    render(
      <CriteriaModal
        rows={[["SMS 발신번호 서류"], ["No", "서류", "비고"]]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("SMS 발신번호 서류")).toHaveAttribute(
      "colspan",
      "3",
    );
    expect(screen.getByText("비고")).not.toHaveAttribute("colspan");
  });
});
