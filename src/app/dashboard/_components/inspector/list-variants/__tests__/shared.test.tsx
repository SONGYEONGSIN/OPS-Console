import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { HandlingRowsBody } from "../shared";

describe("HandlingRowsBody", () => {
  it("행이 있으면 일시/내용 2열로 렌더한다", () => {
    render(
      <HandlingRowsBody
        rows={[
          { time: "09.27 14:27", content: "오류 확인 요청" },
          { time: "09.27 15:03", content: "수정 완료" },
        ]}
      />,
    );
    expect(screen.getByText("09.27 14:27")).toBeInTheDocument();
    expect(screen.getByText("오류 확인 요청")).toBeInTheDocument();
    expect(screen.getByText("수정 완료")).toBeInTheDocument();
  });

  it("내용 없는 빈 행은 제외한다", () => {
    const { container } = render(
      <HandlingRowsBody
        rows={[
          { time: "09.27", content: "유효" },
          { time: "  ", content: "  " },
        ]}
      />,
    );
    expect(screen.getByText("유효")).toBeInTheDocument();
    // 음영 박스 1개 안에 행 1개만
    const box = container.querySelector(".bg-washi-raised");
    expect(box).not.toBeNull();
    expect(within(box as HTMLElement).queryByText("—")).toBeNull();
  });

  it("행이 없고 fallback이 있으면 fallback 텍스트를 음영 박스로 렌더한다", () => {
    render(<HandlingRowsBody rows={[]} fallback="레거시 처리 내용" />);
    const el = screen.getByText("레거시 처리 내용");
    expect(el).toBeInTheDocument();
    expect(el.className).toContain("bg-washi-raised");
  });

  it("행도 fallback도 없으면 '—'를 표시한다", () => {
    render(<HandlingRowsBody rows={[]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
