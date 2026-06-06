import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormattedNotes } from "../FormattedNotes";

describe("FormattedNotes", () => {
  const text = `(1) 기초
- 이전 서비스 복붙
※ 수험번호 차수 추가
참고: https://x.com/a`;

  it("모든 줄 텍스트 표시", () => {
    render(<FormattedNotes text={text} />);
    expect(screen.getByText(/기초/)).toBeInTheDocument();
    expect(screen.getByText(/이전 서비스 복붙/)).toBeInTheDocument();
  });

  it("(1) 소제목은 볼드 강조", () => {
    render(<FormattedNotes text={text} />);
    expect(screen.getByText("(1) 기초")).toHaveClass("font-bold");
  });

  it("※ 주의 줄은 버밀리언 강조", () => {
    render(<FormattedNotes text={text} />);
    expect(screen.getByText(/수험번호 차수 추가/)).toHaveClass("text-vermilion");
  });

  it("URL은 링크로", () => {
    render(<FormattedNotes text={text} />);
    expect(
      screen.getByRole("link", { name: "https://x.com/a" }),
    ).toBeInTheDocument();
  });
});
